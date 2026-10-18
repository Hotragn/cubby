import { useEffect, useMemo, useState } from "react";
import { normalizeNote, mergeNaps, squash } from "../public/lib/normalize.js";
import { checkDay, presence, ageMonths, ageLabel } from "../public/lib/rules.js";
import { PACKS, makePack } from "../public/lib/states.js";
import { sheetFacts, groundCheck, FIXED } from "../public/lib/sheet.js";
import { fmt, dayTime, hhmm } from "../public/lib/time.js";
import { SAMPLE_NOTES, sampleRoster, SAMPLE_STAFF, DEMO_WEEK } from "../public/lib/sample.js";
import SAMPLE_X from "../public/lib/sample-extract.json";
import SAMPLE_W from "../public/lib/sample-week.json";
import VoicePill from "./bits/VoicePill.jsx";
import CountUp from "./bits/CountUp.jsx";
import StatusMark from "./bits/StatusMark.jsx";
import SpringCheck from "./bits/SpringCheck.jsx";
import ClickSpark from "./bits/ClickSpark.jsx";
import { recordAudio, transcribe, warmUpWhisper, voiceSupport } from "./voice.js";
import { Setup, emptyProgram } from "./Setup.jsx";
import { exportPdf, exportCsv, logRows } from "./exports.js";

const KEY = "cubby.v2";
const isoDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => isoDay(new Date());
const shiftDay = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoDay(d); };
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const LANGS = ["English", "Spanish", "Portuguese", "Haitian Creole", "Vietnamese", "Chinese (Simplified)", "Arabic", "French"];
const emptyDay = (date) => ({ date, notes: [], raw: {}, reports: [], resolved: {}, answers: {}, assign: {}, aliases: {} });

// The fictional demo: today plus four earlier days, all read by Gemma ahead of time.
function demoDays() {
  const t = today(), days = {};
  days[t] = { ...emptyDay(t), notes: SAMPLE_NOTES.map(([tt, text], i) => ({ id: `N${i + 1}`, t: tt, text })), raw: SAMPLE_X.notes };
  for (const w of DEMO_WEEK) {
    const date = shiftDay(t, -w.back);
    days[date] = { ...emptyDay(date), notes: w.notes.map(([tt, text], i) => ({ id: `W${w.back}N${i + 1}`, t: tt, text })), raw: SAMPLE_W.days[w.back] ?? {} };
  }
  return days;
}
function fresh() { return { v: 2, mode: "demo", demo: { built: today(), days: demoDays() }, program: emptyProgram(), days: {} }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s?.v === 2) { if (s.demo?.built !== today()) s.demo = { built: today(), days: demoDays() }; return s; }
  } catch {}
  return fresh();
}

// Notes → checked events → flags. Pure, runs on every change, on this device.
export function derive(day, pack) {
  const events = [], questions = [];
  const ctx = { aliases: day.aliases ?? {}, assign: day.assign ?? {} };
  for (const n of day.notes) {
    if (!day.raw?.[n.id]) continue;
    const r = normalizeNote(n, day.raw[n.id], day.roster, day.staff, ctx);
    events.push(...r.events); questions.push(...r.questions);
  }
  const d = { ...day, events: mergeNaps(events, questions), questions: questions.map((q) => ({ ...q, answered: !!day.answers?.[q.noteId + "|" + q.ask] })) };
  // Missing sign-outs and open naps only count once the day is over (past day, or after closing).
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const endOfDay = day.sample || day.date < today() || nowMin >= (dayTime(pack.defaults.close) ?? 1050);
  const flags = checkDay(d, pack, { endOfDay }).map((f) => ({ ...f, key: `${f.rule}|${(f.kids ?? []).join(",")}|${f.title}` }));
  return { d, flags };
}

export default function App() {
  const [st, setSt] = useState(load);
  const [tab, setTab] = useState("today");
  const [viewDate, setViewDate] = useState(today());
  const [toast, setToast] = useState(null);
  const [incident, setIncident] = useState(null);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(0);
  const [server, setServer] = useState(null);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }, [st]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setServer).catch(() => {}); }, []);

  const demo = st.mode === "demo";
  const pack = useMemo(() => (demo ? PACKS.MA : makePack(st.program)), [demo, st.program]);
  const ctxFor = (date) => {
    const base = demo ? st.demo.days[date] ?? emptyDay(date) : st.days[date] ?? emptyDay(date);
    return demo
      ? { ...base, sample: true, roster: sampleRoster(today()), staff: SAMPLE_STAFF, settings: { open: "7:00", close: "17:30" }, state: "MA", host: "Rosa's" }
      : { ...base, roster: st.program.roster, staff: st.program.staff, settings: st.program.settings, state: st.program.state, host: st.program.name || "your daycare" };
  };
  const day = ctxFor(viewDate);
  const { d, flags } = useMemo(() => derive(day, pack), [st, viewDate, pack]);
  const open = flags.filter((f) => !day.resolved?.[f.key]);
  const fixes = open.filter((f) => f.level === "fix");
  const isToday = viewDate === today();

  const updateDay = (date, fn) => setSt((s) => {
    if (s.mode === "demo") return { ...s, demo: { ...s.demo, days: { ...s.demo.days, [date]: fn(s.demo.days[date] ?? emptyDay(date)) } } };
    return { ...s, days: { ...s.days, [date]: fn(s.days[date] ?? emptyDay(date)) } };
  });

  async function read(notes, date) {
    const cur = ctxFor(date);
    const aliases = Object.fromEntries(Object.entries(cur.aliases ?? {}).map(([a, id]) => [a, cur.roster.find((c) => c.id === id)?.name ?? ""]));
    const r = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes, roster: cur.roster.map((c) => ({ name: c.name })), staff: cur.staff.map((s) => ({ name: s.name })), aliases }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "failed");
    return j;
  }

  async function addNote(text) {
    if (!demo && !st.program.roster.length) { setSetup(true); setToast({ kind: "err", text: "Add your children in Setup first." }); return; }
    const id = `U${Date.now().toString(36)}`;
    const note = { id, t: nowHHMM(), text: text.trim() };
    if (!note.text) return;
    const date = today();
    if (viewDate !== date) setViewDate(date);
    updateDay(date, (dd) => ({ ...dd, notes: [...dd.notes, note] }));
    setBusy((b) => b + 1);
    try {
      const j = await read([note], date);
      const raw = j.notes[id] ?? { events: [], questions: [{ quote: note.text, ask: "The reader couldn't read this note. Check it by hand." }] };
      updateDay(date, (dd) => ({ ...dd, raw: { ...dd.raw, [id]: raw } }));
      const n = (raw.events ?? []).length;
      setToast({ kind: "ok", text: `${n} event${n === 1 ? "" : "s"} from your note · ${(j.usage.wallMs / 1000).toFixed(1)}s` });
    } catch (e) {
      updateDay(date, (dd) => ({ ...dd, raw: { ...dd.raw, [id]: { events: [], questions: [{ quote: note.text, ask: "Couldn't reach the reader. The note is saved; check it by hand." }] } } }));
      setToast({ kind: "err", text: String(e.message || e) });
    } finally { setBusy((b) => b - 1); }
  }

  // Local-mode check: send every note of the day back through whatever model this server runs.
  async function reReadDay() {
    const notes = day.notes; if (!notes.length) return;
    setBusy((b) => b + 1); const t0 = performance.now();
    try {
      const j = await read(notes, viewDate);
      updateDay(viewDate, (dd) => ({ ...dd, raw: { ...dd.raw, ...j.notes } }));
      setToast({ kind: "ok", text: `Re-read ${notes.length} notes with ${server?.model ?? "the server model"} in ${((performance.now() - t0) / 1000).toFixed(0)} s` });
    } catch (e) { setToast({ kind: "err", text: String(e.message || e) }); } finally { setBusy((b) => b - 1); }
  }

  function answer(q, kid, text) {
    const key = q.noteId + "|" + q.ask;
    const phrase = q.phrase ?? String(q.ask).match(/["“'‘]([^"”'’]{2,30})["”'’]/)?.[1];
    const child = d.roster.find((c) => c.id === kid);
    updateDay(viewDate, (dd) => {
      const out = { ...dd, answers: { ...dd.answers, [key]: kid ?? text ?? true } };
      if (kid) {
        out.assign = { ...dd.assign, [q.noteId]: kid };
        if (phrase && !d.roster.some((c) => squash(c.name) === squash(phrase))) out.aliases = { ...dd.aliases, [squash(phrase)]: kid };
      }
      return out;
    });
    if (child) setToast({ kind: "ok", text: phrase ? `Attached to ${child.name}. “${phrase}” means ${child.name} for the rest of today.` : `Attached to ${child.name}.` });
  }

  const resolve = (f, how) => updateDay(viewDate, (dd) => ({ ...dd, resolved: { ...dd.resolved, [f.key]: { how, at: nowHHMM() } } }));
  const unresolve = (f) => updateDay(viewDate, (dd) => { const r = { ...dd.resolved }; delete r[f.key]; return { ...dd, resolved: r }; });
  const saveReport = (r) => { updateDay(viewDate, (dd) => ({ ...dd, reports: [...(dd.reports ?? []).filter((x) => !(x.kid === r.kid && x.noteId === r.noteId)), r] })); setIncident(null); setToast({ kind: "ok", text: `Incident report saved for ${r.child}` }); };
  const setMode = (mode) => { setSt((s) => ({ ...s, mode })); setViewDate(today()); if (mode === "mine" && !st.program.roster.length) setSetup(true); };

  const needsSetup = !demo && !st.program.roster.length;
  return (
    <div className="app">
      <Header st={st} d={d} pack={pack} fixes={fixes.length} setMode={setMode} openSetup={() => setSetup(true)} isToday={isToday} backToToday={() => setViewDate(today())} />
      <nav className="tabs" role="tablist">
        {[["today", "Today"], ["fix", "Fix", fixes.length], ["parents", "Parents"], ["week", "Week"], ["log", "Log"]].map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}{n ? <span className="badge">{n}</span> : null}</button>
        ))}
      </nav>
      <main>
        {needsSetup && tab !== "week" ? <div className="card empty"><h2>Set up your program</h2><p className="muted">Add your children, staff and rules. Everything stays on this device.</p><button className="btn primary" onClick={() => setSetup(true)}>Open setup</button><button className="link" onClick={() => setMode("demo")}>Or look at the demo day</button></div> : <>
          {tab === "today" && <Today key={d.date + st.mode} d={d} flags={open} go={setTab} pack={pack} />}
          {tab === "fix" && <Fix d={d} flags={flags} day={day} resolve={resolve} unresolve={unresolve} openIncident={setIncident} answer={answer} />}
          {tab === "parents" && <Parents d={d} flags={open} setToast={setToast} />}
          {tab === "week" && <Week ctxFor={ctxFor} pack={pack} viewDate={viewDate} open={(date) => { setViewDate(date); setTab("today"); }} setToast={setToast} />}
          {tab === "log" && <Log d={d} flags={open} pack={pack} />}
        </>}
      </main>
      {isToday && <Capture onSend={addNote} busy={busy} roster={d.roster} setToast={setToast} />}
      {incident && <IncidentSheet draft={incident} onClose={() => setIncident(null)} onSave={saveReport} />}
      {setup && <Setup program={st.program} onChange={(program) => setSt((s) => ({ ...s, program }))} onClose={() => setSetup(false)} st={st} setSt={setSt} setToast={setToast} reReadDay={reReadDay} canReRead={day.notes.length > 0} server={server} />}
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
      <footer className="foot">
        <p>{demo ? "Fictional demo. Every child and adult here is invented." : "Your program and notes stay in this browser. Notes are sent to the reader model to be turned into events."} Reader: {server ? (server.local ? `${server.model} on this computer (Ollama)` : `${server.model} (Google AI Studio)`) : "Gemma"}. Every check is plain code.</p>
      </footer>
    </div>
  );
}

function Header({ st, d, pack, fixes, setMode, openSetup, isToday, backToToday }) {
  const dateStr = new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const title = `${dateStr} at ${d.host}`;
  return (
    <header className="hero">
      <div className="brand">
        <span className="logo" aria-hidden="true"><i /><i /><i /><i /></span>
        <b>Cubby</b>
        <div className="modes" role="group" aria-label="Which program">
          <button className={st.mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>Demo</button>
          <button className={st.mode === "mine" ? "on" : ""} onClick={() => setMode("mine")}>My program</button>
        </div>
        <button className="gear" onClick={openSetup} aria-label="Setup">⚙</button>
      </div>
      <h1 className="h1" key={title} aria-label={title}>{title.split(" ").map((w, i) => <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 70}ms` }}>{w}&nbsp;</span>)}</h1>
      {!isToday && <button className="pastday" onClick={backToToday}>Viewing a past day · back to today</button>}
      <p className="sub">{st.mode === "demo" ? <>Fictional demo day. </> : null}Talk through the day. Gemma turns your notes into a log. Code checks it against <a href={pack.cites.ratio.url} target="_blank" rel="noreferrer">{pack.short}</a> and writes each parent's sheet.</p>
      <div className="stats">
        <div><CountUp key={"n" + d.date + d.notes.length} to={d.notes.length} duration={0.9} trigger="load" className="num" /><span>quick notes</span></div>
        <div className="arrow" aria-hidden="true">→</div>
        <div><CountUp key={"e" + d.date + d.events.length} to={d.events.length} duration={1.1} trigger="load" className="num" /><span>log entries</span></div>
        <div className="arrow" aria-hidden="true">→</div>
        <div className={fixes ? "hot" : "cool"}><CountUp key={"f" + d.date + fixes} to={fixes} duration={1.3} trigger="load" className="num" /><span>to fix before close</span></div>
      </div>
    </header>
  );
}

const Avatar = ({ c, size = 40 }) => <span className="avatar" style={{ "--c": c.color ?? "#6A6D88", width: size, height: size, fontSize: size * 0.42 }}>{c.name[0]}</span>;

function statusOf(d, c, at, pack) {
  const w = presence(d).kids[c.id];
  if (w.in == null) return { s: "away", label: "Not in yet" };
  if (w.out != null && w.out <= at) return { s: "gone", label: `Home ${fmt(w.out)}` };
  const nap = d.events.find((e) => e.type === "nap" && e.kids?.includes(c.id) && e.start <= at && (e.end == null || e.end > at));
  if (nap) {
    const checks = d.events.filter((e) => e.type === "sleep_check" && e.kids?.includes(c.id) && e.start >= nap.start && e.start <= at).map((e) => e.start);
    const age = ageMonths(c, d.date);
    const every = age != null && age < pack.sleep.infantMonths ? pack.sleep.infantEveryMin : pack.sleep.everyMin;
    const due = Math.max(nap.start, ...checks) + every;
    return { s: "nap", label: `Napping since ${fmt(nap.start)}`, due, late: at > due };
  }
  return { s: "here", label: `Here since ${fmt(w.in)}` };
}

function Today({ d, flags, go, pack }) {
  const times = d.notes.map((n) => dayTime(n.t)).filter((x) => x != null);
  const last = times.length ? Math.max(...times) : dayTime(nowHHMM());
  const lo = times.length ? Math.min(...times) : last;
  const [at, setAt] = useState(d.sample && d.date === today() ? Math.min(last, 14 * 60 + 50) : last);
  const byKid = (id) => flags.filter((f) => f.kids?.includes(id) && f.level === "fix").length;
  const adults = Object.entries(presence(d).adults).filter(([, ws]) => ws.some((w) => (w.in ?? 0) <= at && (w.out == null || at < w.out))).map(([id]) => d.staff.find((s) => s.id === id)?.name);
  const over = flags.find((f) => f.rule === "ratio" && f.window && f.window[0] <= at && at < f.window[1]);
  return (
    <section className="stack">
      <div className="card">
        <div className="row between"><h2>Who's here</h2><span className="muted mono">{fmt(at)}</span></div>
        <p className="adults muted small">Adults signed in: <b>{adults.length ? adults.join(", ") : "none"}</b></p>
        {over && <button className="over" onClick={() => go("fix")}><b>Over ratio right now.</b> {over.title.split(": ")[1]}</button>}
        {lo < last && <input type="range" className="scrub" min={lo} max={last} step={5} value={at} onChange={(e) => setAt(+e.target.value)} aria-label="Scrub through the day" />}
        <ul className="kids">
          {d.roster.map((c) => { const st = statusOf(d, c, at, pack); const n = byKid(c.id); return (
            <li key={c.id} className={`kid ${st.s}`}>
              <Avatar c={c} />
              <div className="grow"><b>{c.name}</b> <span className="muted">{ageLabel(ageMonths(c, d.date))}</span>{c.allergies?.length ? <span className="allergy" title="Allergies on file">⚠ {c.allergies.join(", ")}</span> : null}<div className="state"><i className={`dot ${st.s}`} />{st.label}</div>{st.due != null && <div className={`due ${st.late ? "late" : ""}`}>{st.late ? `Sleep check overdue since ${fmt(st.due)}` : `Next sleep check by ${fmt(st.due)}`}</div>}</div>
              {n ? <button className="chip hot" onClick={() => go("fix")}>{n} to fix</button> : <span className="chip cool">OK</span>}
            </li>); })}
        </ul>
      </div>
      <div className="card">
        <div className="row between"><h2>Notes</h2><span className="muted">{d.notes.length} notes · {d.events.length} entries</span></div>
        {!d.notes.length && <p className="muted">No notes yet. Type or hold the mic below: “{d.roster[0]?.name ?? "Ava"} here, mom dropped off”.</p>}
        <ol className="feed">
          {[...d.notes].reverse().map((n) => {
            const evs = d.events.filter((e) => e.noteId === n.id || e.endNoteId === n.id);
            return (
              <li key={n.id}>
                <time className="mono">{fmt(dayTime(n.t))}</time>
                <div className="grow">
                  <p className="note">“{n.text}”</p>
                  <div className="evs">{evs.map((e) => <EvChip key={e.id + n.id} e={e} d={d} />)}{!d.raw?.[n.id] && <span className="ev pending">reading…</span>}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const ICON = { arrive: "↘", depart: "↗", staff_in: "●", staff_out: "○", meal: "🍽", bottle: "🍼", nap: "☾", sleep_check: "👁", diaper: "◌", incident: "!", med: "℞", mood: "☺", activity: "✦", note: "✎" };
function EvChip({ e, d }) {
  const who = e.staff ? d.staff.find((s) => s.id === e.staff)?.name : (e.kids ?? []).map((k) => d.roster.find((c) => c.id === k)?.name).join(" + ");
  const what = { arrive: "in", depart: "out", staff_in: "signed in", staff_out: "signed out", meal: e.amount ?? "meal", bottle: e.oz != null ? `${e.oz} oz` : "bottle", nap: e.end != null ? `${fmt(e.start)}–${fmt(e.end)}` : `down ${fmt(e.start)}`, sleep_check: "sleep check", diaper: e.toilet ? "potty" : e.kind ?? "diaper", incident: "incident", med: `${e.med ?? "med"} ${e.dose ?? ""}`, mood: e.mood ?? "mood", activity: e.what ?? "activity", note: "note" }[e.type];
  return <span className={`ev t-${e.type} ${e.verified ? "" : "unv"}`} title={e.quote}><i>{ICON[e.type]}</i>{who} · {what}{e.type !== "nap" && e.timeSrc === "stated" ? ` · ${fmt(e.start)}` : ""}{e.answered ? " ✓" : ""}</span>;
}

function Evidence({ ev }) {
  return (
    <ul className="evidence">
      {ev.filter(Boolean).slice(0, 4).map((x, i) => <li key={i}><time className="mono">{x.t ? fmt(dayTime(x.t)) : ""}</time><q>{x.quote}</q>{x.verified === false && <em className="warn"> quote not in note</em>}</li>)}
      {ev.length > 4 && <li className="more muted">+ {ev.length - 4} more notes</li>}
    </ul>
  );
}

const RULE_LABEL = { sleep: "Sleep checks", incident: "Incident report", med: "Medication", ratio: "Ratio", attendance: "Attendance", late: "Late pickup", time: "Times", evidence: "Evidence", question: "Question", allergy: "Allergy" };
const isWhichChild = (ask) => /which (child|kid|children|kids)|who is|whose|the baby|which one/i.test(ask);

function Fix({ d, flags, day, resolve, unresolve, openIncident, answer }) {
  const open = flags.filter((f) => !day.resolved?.[f.key]);
  const done = flags.filter((f) => day.resolved?.[f.key]);
  const reports = (day.reports ?? []).filter((r) => r.status === "done");
  const answered = d.questions.filter((q) => q.answered);
  if (!flags.length && !reports.length) return <div className="card empty"><StatusMark status="done" size={44} /><h2>Nothing to fix</h2><p className="muted">Every rule passed for this day's log.</p></div>;
  return (
    <section className="stack">
      <p className="lede">Each item shows the words that triggered it and the rule it comes from. Gemma only read the notes; these checks are code.</p>
      {open.map((f, i) => (
        <article key={f.key} className={`flag ${f.level}`} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
          <div className="row between top">
            <span className={`tag ${f.rule}`}>{RULE_LABEL[f.rule] ?? f.rule}</span>
            <span className="kidsmini">{(f.kids ?? []).map((k) => { const c = d.roster.find((x) => x.id === k); return c ? <Avatar key={k} c={c} size={22} /> : null; })}</span>
          </div>
          <h3>{f.title}</h3>
          {f.detail && <p className="detail">{f.detail}</p>}
          <Evidence ev={f.evidence ?? []} />
          {f.cite && <a className="cite" href={f.cite.url} target="_blank" rel="noreferrer"><b>{f.cite.sec}</b> {f.cite.text}</a>}
          <div className="actions">
            {f.fix?.kind === "incident" && <button className="btn primary" onClick={() => openIncident(f.fix.draft)}>Open pre-filled report</button>}
            {f.rule === "question" ? (isWhichChild(f.title)
              ? <div className="pick"><span className="small muted">Which child?</span><div className="row gap wrap">{d.roster.map((c) => <button key={c.id} className="kidpick" style={{ "--c": c.color }} onClick={() => answer(f.q, c.id)}><Avatar c={c} size={22} />{c.name}</button>)}<button className="link small" onClick={() => answer(f.q, null, "not a child")}>Not about a child</button></div></div>
              : <AnswerBox onDone={(a) => answer(f.q, null, a)} />)
              : <SpringCheck label={f.fix?.kind === "incident" ? "Handled on paper" : "Checked, I've handled it"} checked={false} onChange={() => resolve(f, "provider")} color="var(--ink)" fillColor="var(--ink)" checkColor="var(--bg)" boxSize={22} boxRadius={7} fontSize={14} />}
          </div>
        </article>
      ))}
      {(done.length > 0 || reports.length > 0 || answered.length > 0) && (
        <details className="card done" open={open.length === 0}>
          <summary>{done.length + reports.length + answered.length} handled</summary>
          <ul>{done.map((f) => <li key={f.key}><span className="tick">✓</span>{f.title} <span className="muted">· {day.resolved[f.key].at}</span> <button className="link" onClick={() => unresolve(f)}>undo</button></li>)}
            {reports.map((r) => <li key={r.kid + r.noteId}><span className="tick">✓</span>Incident report: {r.child}, {fmt(dayTime(r.time) ?? r.time)}</li>)}
            {answered.map((q) => <li key={q.noteId + q.ask}><span className="tick">✓</span>{q.ask} → {d.roster.find((c) => c.id === day.answers[q.noteId + "|" + q.ask])?.name ?? String(day.answers[q.noteId + "|" + q.ask])}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

function AnswerBox({ onDone }) {
  const [v, setV] = useState("");
  return <form className="answer" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onDone(v.trim()); }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="Your answer" aria-label="Answer" /><button className="btn">Save</button></form>;
}

function IncidentSheet({ draft, onClose, onSave }) {
  const [f, setF] = useState({ what: draft.what ?? "", body: draft.body ?? "", action: draft.action ?? "", by: draft.by ?? "", time: draft.time != null ? hhmm(draft.time) : "", parent: "", how: "In person at pickup", signed: "" });
  const req = ["what", "body", "action", "by", "time", "parent", "signed"];
  const missing = req.filter((k) => !String(f[k]).trim());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Incident report" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="grab" />
        <div className="row between"><h2>Incident report · {draft.child}</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <p className="muted small">Pre-filled from the note below. Fields Gemma couldn't find in the note are empty, not guessed.</p>
        <blockquote>“{draft.quote}”</blockquote>
        <div className="grid2"><label>Time<input type="time" value={f.time} onChange={set("time")} /></label><label>Seen by<input value={f.by} onChange={set("by")} placeholder="Who saw it" /></label></div>
        <label>What happened<textarea rows={2} value={f.what} onChange={set("what")} /></label>
        <div className="grid2"><label>Body part<input value={f.body} onChange={set("body")} /></label><label>First aid given<input value={f.action} onChange={set("action")} /></label></div>
        <div className="grid2"><label>Parent told (time)<input type="time" value={f.parent} onChange={set("parent")} /></label><label>How<select value={f.how} onChange={set("how")}><option>In person at pickup</option><option>Phone call</option><option>Text message</option><option>Written note</option></select></label></div>
        <label>Signed by (type your name)<input value={f.signed} onChange={set("signed")} /></label>
        <p className="small muted">MA 606 CMR 7.08(8): parents get this in writing within 24 hours; immediately if care went beyond minor first aid.</p>
        <button className="btn primary wide" disabled={missing.length > 0} onClick={() => onSave({ ...f, kid: draft.kid, child: draft.child, noteId: draft.noteId, status: "done" })}>{missing.length ? `Fill ${missing.length} more field${missing.length > 1 ? "s" : ""}` : "Save report"}</button>
      </div>
    </div>
  );
}

function Parents({ d, flags, setToast }) {
  const [kid, setKid] = useState(d.roster[0]?.id);
  const c = d.roster.find((x) => x.id === kid) ?? d.roster[0];
  if (!c) return null;
  return (
    <section className="stack">
      <div className="kidtabs" role="tablist">{d.roster.map((x) => <button key={x.id} role="tab" aria-selected={c.id === x.id} className={c.id === x.id ? "on" : ""} onClick={() => setKid(x.id)} style={{ "--c": x.color }}><Avatar c={x} size={26} />{x.name}</button>)}</div>
      <Sheet key={c.id + d.date} c={c} d={d} flags={flags.filter((f) => f.kids?.includes(c.id) && f.level === "fix")} setToast={setToast} />
    </section>
  );
}

function Sheet({ c, d, flags, setToast }) {
  const { facts } = useMemo(() => sheetFacts(d, c.id), [d, c.id]);
  const [lang, setLang] = useState(c.lang ?? "English");
  const [warm, setWarm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [audio, setAudio] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const plain = facts.map((f) => f.text).join(" ");
  const fixed = facts.filter((f) => FIXED.has(f.k));
  const photoOk = c.photoConsent !== false;
  async function makeWarm() {
    setWarm({ status: "running" });
    try {
      const r = await fetch("/api/sheet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ child: c.name, facts: facts.filter((f) => !FIXED.has(f.k)).map((f) => f.text), lang }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      const check = groundCheck(j.text, facts.filter((f) => !FIXED.has(f.k)), lang);
      setWarm({ status: check.ok ? "done" : "failed", text: j.text, check, lang });
    } catch (e) { setWarm({ status: "failed", text: null, check: { problems: [String(e.message || e)] } }); }
  }
  const finalText = warm?.status === "done" ? [warm.text, ...fixed.map((f) => f.text)].join("\n\n") : plain;
  async function listen() {
    if (audio) { audio.currentTime = 0; audio.play(); return; }
    setSpeaking(true);
    try {
      const r = await fetch("/api/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: finalText }) });
      if (!r.ok) throw new Error((await r.json()).error);
      const a = new Audio(URL.createObjectURL(await r.blob())); setAudio(a); a.play();
    } catch (e) { setToast({ kind: "err", text: String(e.message || e) }); } finally { setSpeaking(false); }
  }
  async function share() {
    const text = `${c.name}'s day\n\n${finalText}`;
    try { if (navigator.share) await navigator.share({ title: `${c.name}'s day`, text }); else { await navigator.clipboard.writeText(text); setToast({ kind: "ok", text: "Copied. Paste it into your parent chat." }); } } catch {}
  }
  if (!facts.length) return <div className="card empty"><p className="muted">Nothing logged for {c.name} on this day yet.</p></div>;
  return (
    <article className="card sheetcard" style={{ "--c": c.color }}>
      <div className="paper">
        <div className="row gap"><Avatar c={c} size={48} /><div><h2>{c.name}'s day</h2><span className="muted">{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div></div>
        {photoOk ? <label className={`photo ${photo ? "has" : ""}`}>
          {photo ? <img src={photo} alt={`Photo for ${c.name}'s sheet`} /> : <span>＋ Add today's photo<small>Stays on this phone</small></span>}
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); }} />
        </label> : <p className="nophoto small muted">No photo consent on file for {c.name}, so there's no photo slot.</p>}
        {warm?.status === "done" ? <p className="warm" dir={warm.lang === "Arabic" ? "rtl" : "ltr"}>{warm.text}</p> : null}
        {warm?.status === "done" && fixed.length > 0 && <div className="fixedbox"><b>Exactly as logged</b> (health and safety lines are never re-worded){fixed.map((f, i) => <p key={i}>{f.text}</p>)}</div>}
        <ul className="facts">{facts.map((f, i) => <li key={i} className={`f-${f.k}`}><time className="mono">{f.t != null ? fmt(f.t) : ""}</time>{f.text.replace(/ at \d{1,2}:\d{2} [ap]m/, "")}</li>)}</ul>
      </div>
      {flags.length > 0 && <div className="hold"><b>{flags.length} open item{flags.length > 1 ? "s" : ""} for {c.name}.</b> Fix them first so the sheet and the log agree.</div>}
      <div className="row gap wrap tools">
        <select value={lang} onChange={(e) => { setLang(e.target.value); setWarm(null); setAudio(null); }} aria-label="Parent's language">{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
        <button className="btn" onClick={makeWarm} disabled={warm?.status === "running"}>{warm?.status === "running" ? "Writing…" : lang === "English" ? "Write it warmly" : `Write in ${lang}`}</button>
      </div>
      {warm && warm.status !== "running" && (
        <div className={`check ${warm.status}`}>
          <StatusMark status={warm.status} size={20} />
          {warm.status === "done" ? <span>Every time{lang === "English" ? ", food and health word" : " and number"} matches the log.</span> : <span>Gemma's version said things the log doesn't ({warm.check.problems.slice(0, 2).join("; ")}). Using the plain sheet instead.</span>}
        </div>
      )}
      <div className="row gap wrap">
        <button className="btn" onClick={listen} disabled={speaking}>{speaking ? "Loading voice…" : "▶ Listen"}</button>
        <ClickSpark sparkColor={c.color} sparkCount={10} sparkRadius={22}><button className="btn primary" onClick={share}>Send to parent</button></ClickSpark>
      </div>
    </article>
  );
}

function Week({ ctxFor, pack, viewDate, open, setToast }) {
  const end = today();
  const dates = Array.from({ length: 7 }, (_, i) => shiftDay(end, i - 6));
  const rows = dates.map((date) => {
    const day = ctxFor(date);
    if (!day.notes.length) return { date, empty: true };
    const { d, flags } = derive(day, pack);
    const p = presence(d);
    const fixes = flags.filter((f) => f.level === "fix");
    const resolved = fixes.filter((f) => day.resolved?.[f.key]).length + (day.reports ?? []).filter((r) => r.status === "done").length;
    return { date, d, flags, day, attendance: Object.values(p.kids).filter((w) => w.in != null).length, opened: fixes.length, resolved, incidents: d.events.filter((e) => e.type === "incident").length, meds: d.events.filter((e) => e.type === "med").length, open: fixes.filter((f) => !day.resolved?.[f.key]).length };
  });
  const full = rows.filter((r) => !r.empty);
  const tot = full.reduce((a, r) => ({ opened: a.opened + r.opened, resolved: a.resolved + r.resolved, incidents: a.incidents + r.incidents, meds: a.meds + r.meds }), { opened: 0, resolved: 0, incidents: 0, meds: 0 });
  const max = Math.max(1, ...full.map((r) => r.opened));
  const title = `Weekly log · ${dates[0]} to ${dates[6]}`;
  return (
    <section className="stack">
      <div className="card">
        <div className="row between"><h2>This week</h2><span className="muted small">{full.length} day{full.length === 1 ? "" : "s"} logged</span></div>
        <div className="weektot">
          <div><b>{tot.opened}</b><span>flags opened</span></div><div><b>{tot.resolved}</b><span>resolved</span></div><div><b>{tot.incidents}</b><span>incidents</span></div><div><b>{tot.meds}</b><span>medicine doses</span></div>
        </div>
        <ul className="weekdays">
          {rows.map((r) => (
            <li key={r.date} className={r.empty ? "nodata" : r.date === viewDate ? "on" : ""}>
              <button disabled={r.empty} onClick={() => open(r.date)}>
                <span className="wd">{new Date(r.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}<small>{new Date(r.date + "T12:00:00").getDate()}</small></span>
                {r.empty ? <span className="muted small grow">No notes</span> : <>
                  <span className="grow"><span className="bar"><i style={{ width: `${(r.opened / max) * 100}%` }} /></span><span className="small muted">{r.attendance} children · {r.opened} flag{r.opened === 1 ? "" : "s"}{r.resolved ? ` · ${r.resolved} resolved` : ""}{r.incidents ? ` · ${r.incidents} incident${r.incidents > 1 ? "s" : ""}` : ""}{r.meds ? ` · ${r.meds} med` : ""}</span></span>
                  <span className={`chip ${r.open ? "hot" : "cool"}`}>{r.open ? `${r.open} open` : "clear"}</span>
                </>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Weekly inspector log</h2>
        <p className="muted small">Same format as the daily log: attendance, every entry with the note it came from, and open flags, one section per day.</p>
        <div className="row gap"><button className="btn primary" disabled={!full.length} onClick={() => exportPdf(full.map((r) => ({ d: r.d, flags: r.flags.filter((f) => !r.day.resolved?.[f.key]) })), pack, `cubby-week-${dates[0]}`, title).catch((e) => setToast({ kind: "err", text: String(e.message || e) }))}>Export week PDF</button><button className="btn" disabled={!full.length} onClick={() => exportCsv(full.map((r) => r.d), `cubby-week-${dates[0]}`)}>Export week CSV</button></div>
      </div>
    </section>
  );
}

function Log({ d, flags, pack }) {
  const p = presence(d);
  const rows = logRows(d);
  return (
    <section className="stack">
      <div className="card">
        <div className="row between"><h2>Attendance</h2><span className="muted small">{pack.cites.attendance.sec}</span></div>
        <table className="tbl"><thead><tr><th>Child</th><th>In</th><th>Out</th><th>Picked up by</th></tr></thead>
          <tbody>{d.roster.map((c) => <tr key={c.id}><td><Avatar c={c} size={20} /> {c.name}</td><td className="mono">{fmt(p.kids[c.id].in)}</td><td className="mono">{fmt(p.kids[c.id].out)}</td><td>{p.kids[c.id].outEv?.by ?? "—"}</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <div className="row between"><h2>Inspector log</h2><span className="muted small">{rows.length} entries</span></div>
        <div className="row gap"><button className="btn primary" onClick={() => exportPdf([{ d, flags }], pack, `cubby-log-${d.date}`, `Daily log · ${d.date}`)}>Export PDF</button><button className="btn" onClick={() => exportCsv([d], `cubby-log-${d.date}`)}>Export CSV</button></div>
        <table className="tbl log"><thead><tr><th>Time</th><th>Who</th><th>Entry</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className={`t-${r.type}`}><td className="mono">{r.time}</td><td>{r.who}</td><td>{r.what}<small className="src">“{r.quote}”</small></td></tr>)}</tbody></table>
      </div>
    </section>
  );
}

function Capture({ onSend, busy, roster, setToast }) {
  const [text, setText] = useState("");
  const [rec, setRec] = useState(null);
  const [stt, setStt] = useState(null);
  const vs = useMemo(voiceSupport, []);
  const ex = roster.length ? `${roster[0].name} napped 1:10 to 2:40` : "Ava napped 1:10 to 2:40";
  async function onStart() {
    warmUpWhisper((s) => setStt(s));
    try { setRec(await recordAudio()); } catch (e) { setRec(null); setToast({ kind: "err", text: e?.name === "NotAllowedError" ? "Microphone permission is off. Type the note, or allow the mic in your browser settings." : "No microphone here. Type the note instead." }); }
  }
  async function onStop({ reason }) {
    const r = rec; setRec(null);
    if (!r) return;
    const blob = await r.stop();
    if (reason === "cancel" || reason === "mic-denied") return;
    setStt({ s: "busy", label: "Turning speech into text on this phone…" });
    try { const t = await transcribe(blob, (s) => setStt(s)); setText((v) => (v ? v + " " : "") + t); setStt(null); }
    catch (e) { setStt(null); setToast({ kind: "err", text: String(e?.message) === "too short" ? "That was too short to hear. Hold the mic while you talk." : "Speech-to-text didn't load in this browser. Type the note instead." }); }
  }
  const send = () => { if (text.trim()) { onSend(text); setText(""); } };
  return (
    <form className="capture" onSubmit={(e) => { e.preventDefault(); send(); }}>
      {stt && <div className="stt">{stt.label}</div>}
      <div className="bar">
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Try: “${ex}”`} aria-label="Quick note" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        {vs.ok ? <VoicePill reactive="mic" mode="auto" onStart={onStart} onStop={onStop} accentColor="#FFFFFF" iconColor="#FFFFFF" background="var(--ink)" size={30} ariaLabel="Hold to talk" />
          : <button type="button" className="nomic" onClick={() => setToast({ kind: "err", text: vs.why })} aria-label="Voice notes unavailable here">🎙︎</button>}
        <button className="send" disabled={!text.trim()} aria-label="Add note">{busy ? <StatusMark status="running" size={18} color="currentColor" /> : "↑"}</button>
      </div>
    </form>
  );
}
