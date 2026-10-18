import { useRef, useState } from "react";
import { PACKS, AGE_GROUPS, looserThanState } from "../public/lib/states.js";

const COLORS = ["#FF6B4A", "#2F7BFF", "#00A87E", "#8B5CF6", "#E5A100", "#E5487D", "#0EA5B7", "#6B7A2A", "#C2410C", "#4F46E5", "#0F766E", "#B4234B"];
const LANGS = ["English", "Spanish", "Portuguese", "Haitian Creole", "Vietnamese", "Chinese (Simplified)", "Arabic", "French"];
const uid = (name) => `${String(name || "x").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}-${Math.random().toString(36).slice(2, 6)}`;
const stateRatio = (code) => structuredClone(PACKS[code].ratio);

export function emptyProgram() {
  return { name: "", state: "MA", settings: { open: "7:00", close: "17:30", sleepEvery: PACKS.MA.sleep.everyMin, infantSleepEvery: PACKS.MA.sleep.infantEveryMin, ratio: stateRatio("MA") }, roster: [], staff: [] };
}

const newChild = (i) => ({ id: "", name: "", dob: "", ageGroup: "toddler", lang: "English", allergies: [], photoConsent: true, consents: [], pickup: [{ name: "", rel: "mom" }], color: COLORS[i % COLORS.length] });
const newStaff = () => ({ id: "", name: "", role: "Assistant", hours: "8:00-17:00" });

export function Setup({ program, onChange, onClose, st, setSt, setToast, reReadDay, canReRead, server }) {
  const [tab, setTab] = useState("children");
  const [edit, setEdit] = useState(null); // {kind, i, value}
  const file = useRef(null);
  const set = (patch) => onChange({ ...program, ...patch });
  const setS = (patch) => set({ settings: { ...program.settings, ...patch } });
  const warn = looserThanState(program);

  function saveEdit() {
    const { kind, i, value } = edit;
    if (!value.name.trim()) { setToast({ kind: "err", text: "A name is needed." }); return; }
    const v = { ...value, name: value.name.trim(), id: value.id || uid(value.name) };
    if (kind === "child") {
      v.allergies = (typeof v.allergies === "string" ? v.allergies.split(",") : v.allergies).map((a) => a.trim()).filter(Boolean);
      v.consents = v.consents.filter((c) => c.med.trim());
      v.pickup = v.pickup.filter((p) => p.name.trim());
      if (!v.dob) delete v.dob;
      const list = [...program.roster]; if (i == null) list.push(v); else list[i] = v;
      if (list.filter((c) => c.name.toLowerCase() === v.name.toLowerCase()).length > 1) { setToast({ kind: "err", text: "Two children with the same first name would confuse the notes. Add an initial (e.g. “Ava R”)." }); return; }
      set({ roster: list });
    } else {
      const list = [...program.staff]; if (i == null) list.push(v); else list[i] = v; set({ staff: list });
    }
    setEdit(null);
  }
  function remove(kind, i) {
    if (!confirm("Remove this person from your program? Past notes keep their text.")) return;
    if (kind === "child") set({ roster: program.roster.filter((_, j) => j !== i) }); else set({ staff: program.staff.filter((_, j) => j !== i) });
  }
  function exportFile() {
    const blob = new Blob([JSON.stringify({ cubby: 2, exported: new Date().toISOString(), program, days: st.days }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cubby-program-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
  }
  async function importFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.cubby !== 2 || !j.program?.roster) throw new Error("Not a Cubby file");
      if (!confirm(`Replace your program with ${j.program.roster.length} children and ${Object.keys(j.days ?? {}).length} days from this file?`)) return;
      setSt((s) => ({ ...s, mode: "mine", program: { ...emptyProgram(), ...j.program, settings: { ...emptyProgram().settings, ...j.program.settings } }, days: j.days ?? {} }));
      setToast({ kind: "ok", text: "Program imported." });
    } catch (err) { setToast({ kind: "err", text: `Couldn't import: ${err.message}` }); }
    e.target.value = "";
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Setup" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet setup">
        <div className="grab" />
        <div className="row between"><h2>Setup · {program.name || "your program"}</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        <p className="small muted">Saved on this device only. Use “Export file” to back it up or move it to another phone.{st.mode === "demo" ? " You're looking at the demo; this setup is for “My program”." : ""}</p>
        <div className="segs">{[["children", `Children (${program.roster.length})`], ["staff", `Staff (${program.staff.length})`], ["rules", "Rules"], ["data", "Data"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setEdit(null); }}>{l}</button>)}</div>

        {tab === "children" && !edit && <>
          <ul className="plist">{program.roster.map((c, i) => <li key={c.id}><span className="avatar" style={{ "--c": c.color, width: 30, height: 30, fontSize: 13 }}>{c.name[0]}</span><span className="grow"><b>{c.name}</b> <span className="muted small">{c.dob ? `born ${c.dob}` : AGE_GROUPS[c.ageGroup]?.label}{c.allergies?.length ? ` · allergies: ${c.allergies.join(", ")}` : ""}{c.consents?.length ? ` · ${c.consents.length} med consent${c.consents.length > 1 ? "s" : ""}` : ""}{c.photoConsent === false ? " · no photos" : ""}</span></span><button className="link" onClick={() => setEdit({ kind: "child", i, value: structuredClone(c) })}>Edit</button></li>)}</ul>
          <button className="btn primary" onClick={() => setEdit({ kind: "child", i: null, value: newChild(program.roster.length) })}>+ Add a child</button>
        </>}
        {tab === "children" && edit?.kind === "child" && <ChildForm v={edit.value} onChange={(value) => setEdit({ ...edit, value })} onSave={saveEdit} onCancel={() => setEdit(null)} onRemove={edit.i != null ? () => { remove("child", edit.i); setEdit(null); } : null} />}

        {tab === "staff" && !edit && <>
          <ul className="plist">{program.staff.map((s, i) => <li key={s.id}><span className="grow"><b>{s.name}</b> <span className="muted small">{s.role}{s.hours ? ` · ${s.hours}` : ""}</span></span><button className="link" onClick={() => setEdit({ kind: "staff", i, value: structuredClone(s) })}>Edit</button></li>)}</ul>
          <p className="small muted">Only adults signed in by a note (“Dana in”, “Dana out”) count toward the ratio.</p>
          <button className="btn primary" onClick={() => setEdit({ kind: "staff", i: null, value: newStaff() })}>+ Add an adult</button>
        </>}
        {tab === "staff" && edit?.kind === "staff" && <div className="form">
          <label>Name (as you'd say it in a note)<input value={edit.value.name} onChange={(e) => setEdit({ ...edit, value: { ...edit.value, name: e.target.value } })} /></label>
          <div className="grid2"><label>Role<select value={edit.value.role} onChange={(e) => setEdit({ ...edit, value: { ...edit.value, role: e.target.value } })}><option>Licensed provider</option><option>Assistant</option><option>Substitute</option><option>Volunteer</option></select></label>
          <label>Usual hours<input value={edit.value.hours} placeholder="8:00-17:00" onChange={(e) => setEdit({ ...edit, value: { ...edit.value, hours: e.target.value } })} /></label></div>
          <div className="row gap"><button className="btn primary" onClick={saveEdit}>Save</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button>{edit.i != null && <button className="link danger" onClick={() => { remove("staff", edit.i); setEdit(null); }}>Remove</button>}</div>
        </div>}

        {tab === "rules" && <div className="form">
          <label>Program name<input value={program.name} placeholder="e.g. Rosa's Family Child Care" onChange={(e) => set({ name: e.target.value })} /></label>
          <label>State rules<select value={program.state} onChange={(e) => set({ state: e.target.value })}>{Object.values(PACKS).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
          <p className="small muted">Massachusetts is the only state encoded so far. Each number below starts at the state's rule.</p>
          <div className="grid2"><label>Opens<input type="time" value={hh(program.settings.open)} onChange={(e) => setS({ open: e.target.value })} /></label><label>Closes (late pickup after)<input type="time" value={hh(program.settings.close)} onChange={(e) => setS({ close: e.target.value })} /></label></div>
          <div className="grid2"><label>Sleep check every (min)<input type="number" min="5" max="60" value={program.settings.sleepEvery} onChange={(e) => setS({ sleepEvery: +e.target.value })} /></label><label>Infants every (min)<input type="number" min="5" max="60" value={program.settings.infantSleepEvery} onChange={(e) => setS({ infantSleepEvery: +e.target.value })} /></label></div>
          <h3 className="h3s">Ratio limits</h3>
          <table className="tbl ratio"><thead><tr><th>Adults</th><th>Max children</th><th>Max under 2</th><th>Max under 15 mo</th></tr></thead><tbody>
            {[1, 2, 3].map((n) => { const row = program.settings.ratio.byAdults[n] ?? { total: 0, under: [] }; const u = (m) => row.under?.find((x) => x.months === m)?.max ?? "";
              const upd = (patch) => { const by = structuredClone(program.settings.ratio.byAdults); by[n] = { ...row, ...patch }; setS({ ratio: { ...program.settings.ratio, byAdults: by } }); };
              const updU = (m, val) => { const under = (row.under ?? []).filter((x) => x.months !== m); if (val !== "") under.push({ months: m, max: +val }); upd({ under }); };
              return <tr key={n}><td>{n}</td><td><input type="number" min="0" value={row.total} onChange={(e) => upd({ total: +e.target.value })} /></td><td><input type="number" min="0" value={u(24)} onChange={(e) => updU(24, e.target.value)} placeholder="—" /></td><td><input type="number" min="0" value={u(15)} onChange={(e) => updU(15, e.target.value)} placeholder="—" /></td></tr>; })}
          </tbody></table>
          <button className="link small" onClick={() => setS({ ratio: stateRatio(program.state), sleepEvery: PACKS[program.state].sleep.everyMin, infantSleepEvery: PACKS[program.state].sleep.infantEveryMin })}>Reset to {PACKS[program.state].short}</button>
          {warn.length > 0 && <div className="hold">{warn.map((w, i) => <p key={i}>{w}</p>)}</div>}
        </div>}

        {tab === "data" && <div className="form">
          <div className="row gap wrap"><button className="btn primary" onClick={exportFile}>Export file</button><button className="btn" onClick={() => file.current?.click()}>Import file</button><input ref={file} type="file" accept="application/json,.json" hidden onChange={importFile} /></div>
          <p className="small muted">The file holds your program and every day's notes. Keep it somewhere private.</p>
          <h3 className="h3s">Reader</h3>
          <p className="small">{server ? (server.local ? <>Notes are read by <b>{server.model}</b> on this computer (Ollama). Nothing leaves it.</> : <>Notes are read by <b>{server.model}</b> on Google AI Studio. For real children, run Cubby on your own computer in local mode (see the README).</>) : "Checking…"}</p>
          <button className="btn" disabled={!canReRead} onClick={reReadDay}>Re-read this day's notes with this reader</button>
          <h3 className="h3s">Start over</h3>
          <button className="link danger" onClick={() => { if (confirm("Erase your program and all its days from this device? Export a file first if you want a copy.")) { setSt((s) => ({ ...s, program: emptyProgram(), days: {} })); setToast({ kind: "ok", text: "Erased from this device." }); } }}>Erase my program from this device</button>
        </div>}
      </div>
    </div>
  );
}

const hh = (t) => { const [h, m] = String(t ?? "").split(":"); return h ? `${String(h).padStart(2, "0")}:${m ?? "00"}` : ""; };

function ChildForm({ v, onChange, onSave, onCancel, onRemove }) {
  const set = (patch) => onChange({ ...v, ...patch });
  const setList = (key, i, patch) => { const list = [...v[key]]; list[i] = { ...list[i], ...patch }; set({ [key]: list }); };
  return (
    <div className="form">
      <label>First name (as you'd say it in a note)<input value={v.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <div className="grid2"><label>Date of birth (best for ratios)<input type="date" value={v.dob ?? ""} onChange={(e) => set({ dob: e.target.value })} /></label>
        <label>Or age group<select value={v.ageGroup} onChange={(e) => set({ ageGroup: e.target.value })}>{Object.entries(AGE_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}</select></label></div>
      <div className="grid2"><label>Parent's language<select value={v.lang} onChange={(e) => set({ lang: e.target.value })}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select></label>
        <label>Allergies (comma separated)<input value={Array.isArray(v.allergies) ? v.allergies.join(", ") : v.allergies} placeholder="peanut, dairy" onChange={(e) => set({ allergies: e.target.value })} /></label></div>
      <label className="check-row"><input type="checkbox" checked={v.photoConsent !== false} onChange={(e) => set({ photoConsent: e.target.checked })} /> Parent consents to photos on daily sheets</label>
      <h3 className="h3s">Medication consents on file</h3>
      {v.consents.map((c, i) => <div key={i} className="grid3"><input placeholder="Medicine" value={c.med} onChange={(e) => setList("consents", i, { med: e.target.value })} /><input placeholder="Dose (e.g. 2.5 ml)" value={c.dose} onChange={(e) => setList("consents", i, { dose: e.target.value })} /><input type="date" aria-label="Valid until" value={c.until ?? ""} onChange={(e) => setList("consents", i, { until: e.target.value })} /></div>)}
      <button className="link small" onClick={() => set({ consents: [...v.consents, { med: "", dose: "", until: "" }] })}>+ Add a consent</button>
      <p className="small muted">MA: oral non-prescription consent is renewed weekly (606 CMR 7.11(2)(l)). Cubby flags doses after “valid until”.</p>
      <h3 className="h3s">Authorized pickup</h3>
      {v.pickup.map((p, i) => <div key={i} className="grid2"><input placeholder="Full name" value={p.name} onChange={(e) => setList("pickup", i, { name: e.target.value })} /><select value={p.rel} onChange={(e) => setList("pickup", i, { rel: e.target.value })}><option value="mom">Mom</option><option value="dad">Dad</option><option value="grandma">Grandma</option><option value="grandpa">Grandpa</option><option value="other">Other</option></select></div>)}
      <button className="link small" onClick={() => set({ pickup: [...v.pickup, { name: "", rel: "other" }] })}>+ Add a person</button>
      <div className="row gap"><button className="btn primary" onClick={onSave}>Save child</button><button className="btn" onClick={onCancel}>Cancel</button>{onRemove && <button className="link danger" onClick={onRemove}>Remove</button>}</div>
    </div>
  );
}
