import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeNote, mergeNaps } from "../public/lib/normalize.js";
import { checkDay, presence, ageMonths, ageLabel } from "../public/lib/rules.js";
import { PACKS } from "../public/lib/states.js";
import { sheetFacts, groundCheck, FIXED } from "../public/lib/sheet.js";
import { fmt, dur, dayTime, hhmm } from "../public/lib/time.js";
import { SAMPLE_NOTES, sampleRoster, SAMPLE_STAFF } from "../public/lib/sample.js";
import SAMPLE_X from "../public/lib/sample-extract.json";
import VoicePill from "./bits/VoicePill.jsx";
import CountUp from "./bits/CountUp.jsx";
import StatusMark from "./bits/StatusMark.jsx";
import SpringCheck from "./bits/SpringCheck.jsx";
import ClickSpark from "./bits/ClickSpark.jsx";
import { recordAudio, transcribe, warmUpWhisper } from "./voice.js";

const KEY = "cubby.day.v1";
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const LANGS = ["English", "Spanish", "Portuguese", "Haitian Creole", "Vietnamese", "Chinese (Simplified)", "Arabic", "French"];

function sampleDay() {
  const date = today();
  const notes = SAMPLE_NOTES.map(([t, text], i) => ({ id: `N${i + 1}`, t, text }));
  return { v: 1, sample: true, date, state: "MA", roster: sampleRoster(date), staff: SAMPLE_STAFF, notes, raw: SAMPLE_X.notes, reports: [], resolved: {}, answers: {}, settings: { open: "7:00", close: "17:30" }, model: SAMPLE_X.model };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.v === 1) return s; } catch {}
  return sampleDay();
}

// Notes → checked events → flags. Pure, runs on every change, all on this device.
function derive(day) {
  const events = [], questions = [];
  for (const n of day.notes) {
    if (!day.raw[n.id]) continue;
    const r = normalizeNote(n, day.raw[n.id], day.roster, day.staff);
    events.push(...r.events); questions.push(...r.questions);
  }
  const d = { ...day, events: mergeNaps(events, questions), questions: questions.map((q) => ({ ...q, answered: !!day.answers[q.noteId + q.ask] })) };
  const flags = checkDay(d, PACKS[day.state]).map((f) => ({ ...f, key: `${f.rule}|${(f.kids ?? []).join(",")}|${f.title}` }));
  return { d, flags };
}

export default function App() {
  const [day, setDay] = useState(load);
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
  const [incident, setIncident] = useState(null);
  const [busy, setBusy] = useState(0);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(day)); } catch {} }, [day]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  const { d, flags } = useMemo(() => derive(day), [day]);
  const open = flags.filter((f) => !day.resolved[f.key]);
  const fixes = open.filter((f) => f.level === "fix");
  const pack = PACKS[day.state];

  async function addNote(text, t) {
    const id = `U${Date.now().toString(36)}`;
    const note = { id, t: t || nowHHMM(), text: text.trim() };
    if (!note.text) return;
    setDay((s) => ({ ...s, notes: [...s.notes, note] }));
    setBusy((b) => b + 1);
    try {
      const r = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes: [note], roster: day.roster.map((c) => ({ name: c.name })), staff: day.staff.map((s) => ({ name: s.name })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      const raw = j.notes[id] ?? { events: [], questions: [{ quote: note.text, ask: "Gemma couldn't read this note. Check it by hand." }] };
      const before = open.length;
      setDay((s) => ({ ...s, raw: { ...s.raw, [id]: raw } }));
      const n = (raw.events ?? []).length;
      setToast({ kind: "ok", text: `${n} event${n === 1 ? "" : "s"} from your note · ${(j.usage.wallMs / 1000).toFixed(1)}s`, before });
    } catch (e) {
      setDay((s) => ({ ...s, raw: { ...s.raw, [id]: { events: [], questions: [{ quote: note.text, ask: "Couldn't reach the reader. The note is saved; check it by hand." }] } } }));
      setToast({ kind: "err", text: String(e.message || e) });
    } finally { setBusy((b) => b - 1); }
  }

  const resolve = (f, how) => setDay((s) => ({ ...s, resolved: { ...s.resolved, [f.key]: { how, at: nowHHMM() } } }));
  const saveReport = (r) => { setDay((s) => ({ ...s, reports: [...(s.reports ?? []).filter((x) => !(x.kid === r.kid && x.noteId === r.noteId)), r] })); setIncident(null); setToast({ kind: "ok", text: `Incident report saved for ${r.child}` }); };

  return (
    <div className="app">
      <Header day={day} d={d} pack={pack} fixes={fixes.length} />
      <nav className="tabs" role="tablist">
        {[["today", "Today"], ["fix", "To fix", fixes.length], ["parents", "Parents"], ["log", "Log"]].map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l}{n ? <span className="badge">{n}</span> : null}
          </button>
        ))}
      </nav>
      <main>
        {tab === "today" && <Today d={d} flags={open} go={setTab} />}
        {tab === "fix" && <Fix d={d} flags={flags} day={day} resolve={resolve} openIncident={setIncident} unresolve={(f) => setDay((s) => { const r = { ...s.resolved }; delete r[f.key]; return { ...s, resolved: r }; })} answer={(q, a) => setDay((s) => ({ ...s, answers: { ...s.answers, [q]: a } }))} />}
        {tab === "parents" && <Parents d={d} flags={open} day={day} setDay={setDay} setToast={setToast} />}
        {tab === "log" && <Log d={d} flags={open} pack={pack} />}
      </main>
      <Capture onSend={addNote} busy={busy} roster={day.roster} setToast={setToast} />
      {incident && <IncidentSheet draft={incident} d={d} onClose={() => setIncident(null)} onSave={saveReport} />}
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
      <footer className="foot">
        <p>{day.sample ? "Fictional demo day. Every child and adult here is invented." : "Your day stays in this browser."} Notes are read by Gemma ({day.model ?? "gemma-4-26b-a4b-it"}); every check is plain code. <button className="link" onClick={() => { if (confirm("Reset to the fictional demo day?")) setDay(sampleDay()); }}>Reset demo</button></p>
      </footer>
    </div>
  );
}

function Header({ day, d, pack, fixes }) {
  const events = d.events.length;
  const dateStr = new Date(day.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return (
    <header className="hero">
      <div className="brand">
        <span className="logo" aria-hidden="true"><i /><i /><i /><i /></span>
        <b>Cubby</b>
        {day.sample && <span className="pill demo">Demo · fictional kids</span>}
      </div>
      <h1 className="h1" aria-label={`${dateStr} at Rosa's`}>{`${dateStr} at Rosa's`.split(" ").map((w, i) => <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 70}ms` }}>{w}&nbsp;</span>)}</h1>
      <p className="sub">Talk through the day. Gemma turns your notes into a log. Code checks it against <a href={pack.cites.ratio.url} target="_blank" rel="noreferrer">{pack.short}</a> and writes each parent's sheet.</p>
      <div className="stats">
        <div><CountUp to={day.notes.length} duration={0.9} trigger="load" className="num" /><span>quick notes</span></div>
        <div className="arrow" aria-hidden="true">→</div>
        <div><CountUp to={events} duration={1.1} trigger="load" className="num" /><span>log entries</span></div>
        <div className="arrow" aria-hidden="true">→</div>
        <div className={fixes ? "hot" : "cool"}><CountUp to={fixes} duration={1.3} trigger="load" className="num" /><span>to fix before close</span></div>
      </div>
    </header>
  );
}

const Avatar = ({ c, size = 40 }) => <span className="avatar" style={{ "--c": c.color, width: size, height: size, fontSize: size * 0.42 }}>{c.name[0]}</span>;

function statusOf(d, c, at) {
  const w = presence(d).kids[c.id];
  if (w.in == null) return { s: "away", label: "Not in yet" };
  if (w.out != null && w.out <= at) return { s: "gone", label: `Home ${fmt(w.out)}` };
  const nap = d.events.find((e) => e.type === "nap" && e.kids?.includes(c.id) && e.start <= at && (e.end == null || e.end > at));
  if (nap) {
    // The next sleep check is due 15 minutes after the last one (606 CMR 7.10(7)(d)).
    const checks = d.events.filter((e) => e.type === "sleep_check" && e.kids?.includes(c.id) && e.start >= nap.start && e.start <= at).map((e) => e.start);
    const due = Math.max(nap.start, ...checks) + 15;
    return { s: "nap", label: `Napping since ${fmt(nap.start)}`, due, late: at > due };
  }
  return { s: "here", label: `Here since ${fmt(w.in)}` };
}

function Today({ d, flags, go }) {
  const last = Math.max(...d.notes.map((n) => dayTime(n.t) ?? 0));
  // The demo opens mid-afternoon, when two children are napping and the assistant is out.
  const [at, setAt] = useState(d.sample ? Math.min(last, 14 * 60 + 50) : last);
  const lo = Math.min(...d.notes.map((n) => dayTime(n.t) ?? 1440));
  const byKid = (id) => flags.filter((f) => f.kids?.includes(id) && f.level === "fix").length;
  const adults = Object.entries(presence(d).adults).filter(([, ws]) => ws.some((w) => (w.in ?? 0) <= at && (w.out == null || at < w.out))).map(([id]) => d.staff.find((s) => s.id === id)?.name);
  const over = flags.find((f) => f.rule === "ratio" && f.window && f.window[0] <= at && at < f.window[1]);
  return (
    <section className="stack">
      <div className="card">
        <div className="row between"><h2>Who's here</h2><span className="muted mono">{fmt(at)}</span></div>
        <p className="adults muted small">Adults signed in: <b>{adults.length ? adults.join(", ") : "none"}</b></p>
        {over && <button className="over" onClick={() => go("fix")}><b>Over ratio right now.</b> {over.title.split(": ")[1]}</button>}
        <input type="range" className="scrub" min={lo} max={last} step={5} value={at} onChange={(e) => setAt(+e.target.value)} aria-label="Scrub through the day" />
        <ul className="kids">
          {d.roster.map((c) => { const st = statusOf(d, c, at); const n = byKid(c.id); return (
            <li key={c.id} className={`kid ${st.s}`}>
              <Avatar c={c} />
              <div className="grow"><b>{c.name}</b> <span className="muted">{ageLabel(ageMonths(c, d.date))}</span><div className="state"><i className={`dot ${st.s}`} />{st.label}</div>{st.due != null && <div className={`due ${st.late ? "late" : ""}`}>{st.late ? `Sleep check overdue since ${fmt(st.due)}` : `Next sleep check by ${fmt(st.due)}`}</div>}</div>
              {n ? <button className="chip hot" onClick={() => go("fix")}>{n} to fix</button> : <span className="chip cool">OK</span>}
            </li>); })}
        </ul>
      </div>
      <div className="card">
        <div className="row between"><h2>Today's notes</h2><span className="muted">{d.notes.length} notes · {d.events.length} entries</span></div>
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
  let what = { arrive: "in", depart: "out", staff_in: "signed in", staff_out: "signed out", meal: e.amount ?? "meal", bottle: e.oz != null ? `${e.oz} oz` : "bottle", nap: e.end != null ? `${fmt(e.start)}–${fmt(e.end)}` : `down ${fmt(e.start)}`, sleep_check: "sleep check", diaper: e.toilet ? "potty" : e.kind ?? "diaper", incident: "incident", med: `${e.med ?? "med"} ${e.dose ?? ""}`, mood: e.mood ?? "mood", activity: e.what ?? "activity", note: "note" }[e.type];
  return <span className={`ev t-${e.type} ${e.verified ? "" : "unv"}`} title={e.quote}><i>{ICON[e.type]}</i>{who} · {what}{e.type !== "nap" && e.timeSrc === "stated" ? ` · ${fmt(e.start)}` : ""}</span>;
}

function Evidence({ ev }) {
  return (
    <ul className="evidence">
      {ev.filter(Boolean).slice(0, 4).map((x, i) => <li key={i}><time className="mono">{x.t ? fmt(dayTime(x.t)) : ""}</time><q>{x.quote}</q>{x.verified === false && <em className="warn"> quote not in note</em>}</li>)}
      {ev.length > 4 && <li className="more muted">+ {ev.length - 4} more notes</li>}
    </ul>
  );
}

const RULE_LABEL = { sleep: "Sleep checks", incident: "Incident report", med: "Medication", ratio: "Ratio", attendance: "Attendance", late: "Late pickup", time: "Times", evidence: "Evidence", question: "Question" };

function Fix({ d, flags, day, resolve, unresolve, openIncident, answer }) {
  const open = flags.filter((f) => !day.resolved[f.key]);
  const done = flags.filter((f) => day.resolved[f.key]);
  const done2 = (day.reports ?? []).filter((r) => r.status === "done");
  if (!flags.length) return <div className="card empty"><StatusMark status="done" size={44} /><h2>Nothing to fix</h2><p className="muted">Every rule passed for today's log.</p></div>;
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
            {f.rule === "question" ? <AnswerBox onDone={(a) => { answer(f.evidence[0].noteId + f.title, a); }} /> :
              <SpringCheck label={f.fix?.kind === "incident" ? "Handled on paper" : "Checked, I've handled it"} checked={false} onChange={() => resolve(f, "provider")} color="var(--ink)" fillColor="var(--ink)" checkColor="var(--bg)" boxSize={22} boxRadius={7} fontSize={14} />}
          </div>
        </article>
      ))}
      {(done.length > 0 || done2.length > 0) && (
        <details className="card done">
          <summary>{done.length + done2.length} handled today</summary>
          <ul>{done.map((f) => <li key={f.key}><span className="tick">✓</span>{f.title} <span className="muted">· {day.resolved[f.key].at}</span> <button className="link" onClick={() => unresolve(f)}>undo</button></li>)}
            {done2.map((r) => <li key={r.kid + r.noteId}><span className="tick">✓</span>Incident report: {r.child}, {fmt(dayTime(r.time) ?? r.time)}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

function AnswerBox({ onDone }) {
  const [v, setV] = useState("");
  return <form className="answer" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onDone(v.trim()); }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="Your answer (e.g. Mila)" aria-label="Answer" /><button className="btn">Save</button></form>;
}

function IncidentSheet({ draft, d, onClose, onSave }) {
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
        <div className="grid2">
          <label>Time<input type="time" value={f.time} onChange={set("time")} /></label>
          <label>Seen by<input value={f.by} onChange={set("by")} placeholder="Who saw it" /></label>
        </div>
        <label>What happened<textarea rows={2} value={f.what} onChange={set("what")} /></label>
        <div className="grid2">
          <label>Body part<input value={f.body} onChange={set("body")} /></label>
          <label>First aid given<input value={f.action} onChange={set("action")} /></label>
        </div>
        <div className="grid2">
          <label>Parent told (time)<input type="time" value={f.parent} onChange={set("parent")} /></label>
          <label>How<select value={f.how} onChange={set("how")}><option>In person at pickup</option><option>Phone call</option><option>Text message</option><option>Written note</option></select></label>
        </div>
        <label>Signed by (type your name)<input value={f.signed} onChange={set("signed")} placeholder="Rosa Medina" /></label>
        <p className="small muted">MA 606 CMR 7.08(8): parents get this in writing within 24 hours; immediately if care went beyond minor first aid.</p>
        <button className="btn primary wide" disabled={missing.length > 0} onClick={() => onSave({ ...f, kid: draft.kid, child: draft.child, noteId: draft.noteId, status: "done" })}>{missing.length ? `Fill ${missing.length} more field${missing.length > 1 ? "s" : ""}` : "Save report"}</button>
      </div>
    </div>
  );
}

function Parents({ d, flags, day, setDay, setToast }) {
  const [kid, setKid] = useState(d.roster[0].id);
  const c = d.roster.find((x) => x.id === kid);
  return (
    <section className="stack">
      <div className="kidtabs" role="tablist">{d.roster.map((x) => <button key={x.id} role="tab" aria-selected={kid === x.id} className={kid === x.id ? "on" : ""} onClick={() => setKid(x.id)} style={{ "--c": x.color }}><Avatar c={x} size={26} />{x.name}</button>)}</div>
      <Sheet key={kid} c={c} d={d} flags={flags.filter((f) => f.kids?.includes(kid) && f.level === "fix")} setToast={setToast} />
    </section>
  );
}

function Sheet({ c, d, flags, setToast }) {
  const { facts } = useMemo(() => sheetFacts(d, c.id), [d, c.id]);
  const [lang, setLang] = useState(c.lang ?? "English");
  const [warm, setWarm] = useState(null); // {status, text, check}
  const [photo, setPhoto] = useState(null);
  const [audio, setAudio] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const plain = facts.map((f) => f.text).join(" ");
  const fixed = facts.filter((f) => FIXED.has(f.k));
  async function makeWarm() {
    setWarm({ status: "running" });
    try {
      const r = await fetch("/api/sheet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ child: c.name, facts: facts.filter((f) => !FIXED.has(f.k)).map((f) => f.text), lang }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      const check = groundCheck(j.text, facts.filter((f) => !FIXED.has(f.k)), lang);
      setWarm({ status: check.ok ? "done" : "failed", text: j.text, check, lang, ms: j.usage?.ms });
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
  return (
    <article className="card sheetcard" style={{ "--c": c.color }}>
      <div className="paper">
        <div className="row gap"><Avatar c={c} size={48} /><div><h2>{c.name}'s day</h2><span className="muted">{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div></div>
        <label className={`photo ${photo ? "has" : ""}`}>
          {photo ? <img src={photo} alt={`Photo for ${c.name}'s sheet`} /> : <span>＋ Add today's photo<small>Stays on this phone</small></span>}
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); }} />
        </label>
        {warm?.status === "done" ? <p className="warm" lang={langCode(warm.lang)} dir={warm.lang === "Arabic" ? "rtl" : "ltr"}>{warm.text}</p> : null}
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
const langCode = (l) => ({ Spanish: "es", Portuguese: "pt", "Haitian Creole": "ht", Vietnamese: "vi", "Chinese (Simplified)": "zh", Arabic: "ar", French: "fr" }[l] ?? "en");

function Log({ d, flags, pack }) {
  const p = presence(d);
  const rows = logRows(d);
  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFontSize(15); doc.text(`Daily log · ${d.date}`, 40, 46);
    doc.setFontSize(9); doc.text(`${pack.name}. Generated by Cubby from the provider's notes; each entry keeps the note it came from.${d.sample ? " FICTIONAL DEMO DATA." : ""}`, 40, 62, { maxWidth: 530 });
    autoTable(doc, { startY: 76, head: [["Child", "In", "Dropped off by", "Out", "Picked up by"]], body: d.roster.map((c) => [c.full ?? c.name, fmt(p.kids[c.id].in), p.kids[c.id].inEv?.by ?? "", fmt(p.kids[c.id].out), p.kids[c.id].outEv?.by ?? ""]), styles: { fontSize: 8 } });
    autoTable(doc, { head: [["Time", "Child", "Entry", "From note"]], body: rows.map((r) => [r.time, r.who, r.what, r.quote]), styles: { fontSize: 7, cellPadding: 3 }, columnStyles: { 3: { cellWidth: 200 } } });
    autoTable(doc, { head: [["Open flag", "Rule"]], body: flags.map((f) => [f.title, f.cite?.sec ?? ""]), styles: { fontSize: 8 } });
    doc.save(`cubby-log-${d.date}.pdf`);
  }
  function csv() {
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const out = ["date,time,child,type,entry,source_note", ...rows.map((r) => [d.date, r.time, r.who, r.type, r.what, r.quote].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([out], { type: "text/csv" })); a.download = `cubby-log-${d.date}.csv`; a.click();
  }
  return (
    <section className="stack">
      <div className="card">
        <div className="row between"><h2>Attendance</h2><span className="muted small">{pack.cites.attendance.sec}</span></div>
        <table className="tbl"><thead><tr><th>Child</th><th>In</th><th>Out</th><th>Picked up by</th></tr></thead>
          <tbody>{d.roster.map((c) => <tr key={c.id}><td><Avatar c={c} size={20} /> {c.name}</td><td className="mono">{fmt(p.kids[c.id].in)}</td><td className="mono">{fmt(p.kids[c.id].out)}</td><td>{p.kids[c.id].outEv?.by ?? "—"}</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <div className="row between"><h2>Inspector log</h2><span className="muted small">{rows.length} entries</span></div>
        <div className="row gap"><button className="btn primary" onClick={pdf}>Export PDF</button><button className="btn" onClick={csv}>Export CSV</button></div>
        <table className="tbl log"><thead><tr><th>Time</th><th>Who</th><th>Entry</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className={`t-${r.type}`}><td className="mono">{r.time}</td><td>{r.who}</td><td>{r.what}<small className="src">“{r.quote}”</small></td></tr>)}</tbody></table>
      </div>
    </section>
  );
}

function logRows(d) {
  const name = (e) => e.staff ? d.staff.find((s) => s.id === e.staff)?.name : (e.kids ?? []).map((k) => d.roster.find((c) => c.id === k)?.name).join(", ");
  return [...d.events].sort((a, b) => (a.start ?? 0) - (b.start ?? 0)).map((e) => ({
    time: e.type === "nap" ? `${fmt(e.start)}–${e.end != null ? fmt(e.end) : "?"}` : fmt(e.start), who: name(e), type: e.type,
    what: { arrive: `Signed in${e.by ? `, by ${e.by}` : ""}`, depart: `Signed out${e.by ? `, to ${e.by}` : ""}`, staff_in: "Staff in", staff_out: "Staff out", meal: `${e.meal ?? "Meal"}: ${e.food ?? ""} (${e.amount ?? "amount not noted"})`, bottle: `Bottle ${e.oz ?? "?"} oz`, nap: `Nap${e.end != null ? ` ${dur(e.end - e.start)}` : ""}`, sleep_check: `Sleep check${e.position ? `, ${e.position}` : ""}${e.by ? `, by ${e.by}` : ""}`, diaper: e.toilet ? `Potty (${e.kind ?? ""})` : `Diaper: ${e.kind ?? ""}`, incident: `Incident: ${e.what ?? ""}${e.action ? `; ${e.action}` : ""}`, med: `Medication: ${e.med ?? "?"} ${e.dose ?? "?"}, by ${e.by ?? "?"}`, mood: `Mood: ${e.mood}`, activity: e.what, note: e.what }[e.type],
    quote: e.quote,
  }));
}

function Capture({ onSend, busy, roster, setToast }) {
  const [text, setText] = useState("");
  const [rec, setRec] = useState(null);
  const [stt, setStt] = useState(null);
  const ex = useMemo(() => [`${roster[2]?.name} napped 1:10 to 2:40`, `${roster[1]?.name} ate most of his lunch`, `Checked ${roster[0]?.name} 1:25, on her back`], [roster]);
  async function onStart() {
    warmUpWhisper((s) => setStt(s));
    try { setRec(await recordAudio()); } catch { setToast({ kind: "err", text: "The microphone isn't available here. Type the note instead." }); }
  }
  async function onStop({ reason }) {
    const r = rec; setRec(null);
    if (!r) return;
    const blob = await r.stop();
    if (reason === "cancel" || reason === "mic-denied") return;
    setStt({ s: "busy", label: "Turning speech into text on this phone…" });
    try { const t = await transcribe(blob, (s) => setStt(s)); setText((v) => (v ? v + " " : "") + t); setStt(null); }
    catch (e) { setStt(null); setToast({ kind: "err", text: "Speech-to-text didn't load in this browser. Type the note instead." }); }
  }
  return (
    <form className="capture" onSubmit={(e) => { e.preventDefault(); onSend(text); setText(""); }}>
      {stt && <div className="stt">{stt.label}</div>}
      <div className="bar">
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Try: “${ex[0]}”`} aria-label="Quick note" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(text); setText(""); } }} />
        <VoicePill reactive="mic" mode="auto" onStart={onStart} onStop={onStop} accentColor="#FFFFFF" iconColor="#FFFFFF" background="var(--ink)" size={30} ariaLabel="Hold to talk" />
        <button className="send" disabled={!text.trim()} aria-label="Add note">{busy ? <StatusMark status="running" size={18} color="currentColor" /> : "↑"}</button>
      </div>
    </form>
  );
}
