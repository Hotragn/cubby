// Every rule check is plain code. The model never decides whether something is safe.
// Each flag carries the evidence that produced it (note quotes, times) and the rule's citation.

import { fmt, dur, dayTime } from "./time.js";

const INJURY = /\b(bump(ed|s)?|bit(?! (sleepy|tired|fussy|cranky|of|more|less|better|quiet|slow|late|early|warm|cold|teary|clingy))|bites?|bitten|biting|scratch(ed|es)?|fell|fall|tripped|bleed(ing)?|blood|bruis(e|ed)|cut|hit (his|her|their) head|pinched|scraped?|swollen|swelling|split lip|nosebleed|choked|choking|burn(ed|t)?|sting|stung|injur(y|ed)|ouch|ice pack|bandaid|band-aid|goose ?egg)\b/i;
const MEDS = /\b(tylenol|motrin|advil|ibuprofen|acetaminophen|benadryl|zyrtec|claritin|amoxicillin|antibiotic|inhaler|albuterol|epipen|epi-pen|diaper cream|desitin|hydrocortisone|eye drops|ear drops|medicine|medication|meds|dose(d)?|\d+(\.\d+)?\s?(ml|mg|cc|puffs?))\b/i;

const sev = { fix: 0, check: 1 };

export function ageMonths(child, dateISO) {
  if (!child.dob) return child.ageMonths ?? null;
  const d = new Date(dateISO + "T12:00:00"), b = new Date(child.dob + "T12:00:00");
  return (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth()) - (d.getDate() < b.getDate() ? 1 : 0);
}

const nameOf = (day, id) => day.roster.find((c) => c.id === id)?.name ?? id;
const staffName = (day, id) => day.staff.find((s) => s.id === id)?.name ?? id;
const noteById = (day, id) => day.notes.find((n) => n.id === id);
const ev2evidence = (day, e) => ({ noteId: e.noteId, t: noteById(day, e.noteId)?.t, quote: e.quote, verified: e.verified });

// Presence windows per child and per adult, from sign-in/out events.
export function presence(day) {
  const kids = {}, adults = {};
  for (const c of day.roster) kids[c.id] = { in: null, out: null, inEv: null, outEv: null };
  for (const s of day.staff) adults[s.id] = [];
  const evs = [...day.events].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  for (const e of evs) {
    if (e.type === "arrive") for (const k of e.kids ?? []) if (kids[k] && kids[k].in == null) { kids[k].in = e.start; kids[k].inEv = e; }
    if (e.type === "depart") for (const k of e.kids ?? []) if (kids[k]) { kids[k].out = e.start; kids[k].outEv = e; }
    if (e.type === "staff_in" && adults[e.staff]) adults[e.staff].push({ in: e.start, out: null, inEv: e });
    if (e.type === "staff_out" && adults[e.staff]) {
      const open = adults[e.staff].findLast?.((w) => w.out == null) ?? [...adults[e.staff]].reverse().find((w) => w.out == null);
      if (open) { open.out = e.start; open.outEv = e; } else adults[e.staff].push({ in: null, out: e.start, outEv: e });
    }
  }
  return { kids, adults };
}

// "All the kids had lunch" → everyone signed in at that time.
export function resolveAll(day) {
  const { kids } = presence(day);
  for (const e of day.events) {
    if (e.kids !== null) continue;
    e.kids = Object.entries(kids).filter(([, w]) => w.in != null && w.in <= (e.start ?? 0) && (w.out == null || w.out >= (e.start ?? 0))).map(([id]) => id);
  }
}

export function checkDay(day, pack, opts = {}) {
  resolveAll(day);
  const flags = [];
  const add = (f) => flags.push({ id: `${f.rule}:${flags.length}`, ...f });
  const cite = (k) => pack.cites[k];
  const { kids, adults } = presence(day);
  const close = dayTime(day.settings?.close ?? pack.defaults.close);
  const endOfDay = opts.endOfDay ?? true;

  // 0. The model's quote must be in the note. If not, the event is shown but not trusted.
  for (const e of day.events) if (!e.verified) {
    add({ rule: "evidence", level: "check", kids: e.kids ?? [], title: `Couldn't match this ${e.type.replace("_", " ")} to the note's words`, detail: "The reader's quote isn't in the note. Check the event before it goes into a report.", evidence: [ev2evidence(day, e)] });
  }

  // 1. Times that can't be right.
  for (const e of day.events) {
    const who = (e.kids ?? []).map((k) => nameOf(day, k)).join(", ");
    if (e.type === "nap" && e.start != null && e.end != null && e.end <= e.start)
      add({ rule: "time", level: "fix", kids: e.kids, title: `${who}: nap ends before it starts`, detail: `${fmt(e.start)} → ${fmt(e.end)}`, evidence: [ev2evidence(day, e)], cite: cite("records") });
    for (const k of e.kids ?? []) {
      const w = kids[k]; if (!w || e.type === "arrive" || e.type === "depart" || e.start == null) continue;
      const t0 = e.start, t1 = e.type === "nap" ? (e.end ?? e.start) : e.start;
      if (w.in != null && t0 < w.in) add({ rule: "time", level: "fix", kids: [k], title: `${nameOf(day, k)}: ${label(e)} at ${fmt(t0)}, before sign-in at ${fmt(w.in)}`, evidence: [ev2evidence(day, e), ev2evidence(day, w.inEv)], cite: cite("attendance") });
      if (w.out != null && t1 > w.out) add({ rule: "time", level: "fix", kids: [k], title: `${nameOf(day, k)}: ${label(e)} until ${fmt(t1)}, after sign-out at ${fmt(w.out)}`, evidence: [ev2evidence(day, e), ev2evidence(day, w.outEv)], cite: cite("attendance") });
    }
  }
  const naps = day.events.filter((e) => e.type === "nap" && e.start != null);
  for (const c of day.roster) {
    const mine = naps.filter((n) => n.kids?.includes(c.id)).sort((a, b) => a.start - b.start);
    for (let i = 1; i < mine.length; i++) {
      const prevEnd = mine[i - 1].end ?? mine[i - 1].start;
      if (mine[i].start < prevEnd) add({ rule: "time", level: "fix", kids: [c.id], title: `${c.name}: two naps overlap`, detail: `${fmt(mine[i - 1].start)}–${fmt(mine[i - 1].end)} and ${fmt(mine[i].start)}–${fmt(mine[i].end)}`, evidence: [ev2evidence(day, mine[i - 1]), ev2evidence(day, mine[i])], cite: cite("records") });
    }
  }

  // 2. Sleep checks at the set interval.
  const sc = pack.sleep;
  for (const n of naps) for (const k of n.kids ?? []) {
    const child = day.roster.find((c) => c.id === k); if (!child) continue;
    const age = ageMonths(child, day.date);
    const every = age != null && age < sc.infantMonths ? sc.infantEveryMin : sc.everyMin;
    if (!every) continue;
    if (n.end == null) {
      if (endOfDay) add({ rule: "sleep", level: "fix", kids: [k], title: `${child.name}: nap started ${fmt(n.start)} has no wake-up time`, evidence: [ev2evidence(day, n)], cite: cite("sleep") });
      continue;
    }
    const checks = day.events.filter((e) => e.type === "sleep_check" && e.kids?.includes(k) && e.start != null && e.start >= n.start && e.start <= n.end).map((e) => e.start).sort((a, b) => a - b);
    const pts = [n.start, ...checks, n.end];
    const gaps = [];
    for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > every) gaps.push([pts[i - 1], pts[i]]);
    if (gaps.length) {
      const worst = gaps.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
      add({ rule: "sleep", level: "fix", kids: [k], title: `${child.name}: ${gaps.length} sleep-check gap${gaps.length > 1 ? "s" : ""} longer than ${every} min`, detail: `Longest: ${fmt(worst[0])} → ${fmt(worst[1])} (${dur(worst[1] - worst[0])}). Checks logged: ${checks.length ? checks.map(fmt).join(", ") : "none"}. Nap ${fmt(n.start)}–${fmt(n.end)}.`, evidence: [ev2evidence(day, n), ...day.events.filter((e) => e.type === "sleep_check" && e.kids?.includes(k) && e.start >= n.start && e.start <= n.end).map((e) => ev2evidence(day, e))], cite: cite("sleep") });
    }
  }

  // 3. Injuries need a finished incident report. Code scans the raw notes too, so a
  //    bump the reader missed still raises a flag.
  const reports = day.reports ?? [];
  const injuryHits = [];
  for (const e of day.events.filter((e) => e.type === "incident")) for (const k of e.kids ?? []) injuryHits.push({ k, t: e.start, ev: e });
  for (const n of day.notes) {
    const m = n.text.match(INJURY); if (!m) continue;
    const named = day.roster.filter((c) => new RegExp(`\\b${c.name.split(" ")[0]}\\b`, "i").test(n.text)).map((c) => c.id);
    for (const k of named) if (!injuryHits.some((h) => h.k === k && (h.ev?.noteId ?? h.note?.id) === n.id)) injuryHits.push({ k, t: dayTime(n.t), note: n, word: m[0] });
  }
  const seen = new Set();
  for (const h of injuryHits) {
    const key = `${h.k}@${h.ev?.noteId ?? h.note.id}`; if (seen.has(key)) continue; seen.add(key);
    const done = reports.find((r) => r.kid === h.k && r.status === "done" && (r.noteId === (h.ev?.noteId ?? h.note?.id) || Math.abs((dayTime(r.time) ?? -999) - (h.t ?? 0)) <= 30));
    if (done) continue;
    const child = day.roster.find((c) => c.id === h.k);
    const draft = {
      kid: h.k, child: child?.name, date: day.date, time: h.t, noteId: h.ev?.noteId ?? h.note.id,
      what: h.ev?.what ?? null, body: h.ev?.body ?? null, action: h.ev?.action ?? null, by: h.ev?.by ?? null,
      quote: h.ev?.quote ?? h.note.text, parentInformed: null, missing: [],
    };
    for (const f of ["what", "body", "action", "by"]) if (!draft[f]) draft.missing.push(f);
    add({ rule: "incident", level: "fix", kids: [h.k], title: `${child?.name}: injury mentioned, no incident report`, detail: h.ev ? `Logged as an incident at ${fmt(h.t)}.` : `The note says "${h.word}" but no incident was logged. Code caught the word; check the note.`, evidence: [h.ev ? ev2evidence(day, h.ev) : { noteId: h.note.id, t: h.note.t, quote: h.note.text, verified: true }], cite: cite("incident"), fix: { kind: "incident", draft } });
  }

  // 4. Medication: consent on file, dose, time, who gave it.
  const meds = day.events.filter((e) => e.type === "med");
  for (const e of meds) for (const k of e.kids ?? []) {
    const child = day.roster.find((c) => c.id === k); if (!child) continue;
    const consent = (child.consents ?? []).find((c) => e.med && medMatch(c.med, e.med));
    const missing = [];
    if (!e.med) missing.push("medicine name");
    if (!e.dose) missing.push("dose");
    if (e.start == null) missing.push("time given");
    if (!e.by) missing.push("who gave it");
    const ev = [ev2evidence(day, e)];
    if (!consent) add({ rule: "med", level: "fix", kids: [k], title: `${child.name}: ${e.med ?? "medicine"} given with no parent consent on file`, detail: (child.consents ?? []).length ? `On file: ${child.consents.map((c) => `${c.med} ${c.dose}`).join("; ")}.` : "No medication consents on file for this child.", evidence: ev, cite: cite("med") });
    else {
      if (e.dose && consent.dose && !doseMatch(consent.dose, e.dose)) add({ rule: "med", level: "fix", kids: [k], title: `${child.name}: dose ${e.dose} doesn't match the consent (${consent.dose})`, evidence: ev, cite: cite("med") });
      if (consent.until && day.date > consent.until) add({ rule: "med", level: "fix", kids: [k], title: `${child.name}: consent for ${consent.med} expired ${consent.until}`, evidence: ev, cite: cite("med") });
    }
    if (missing.length) add({ rule: "med", level: "fix", kids: [k], title: `${child.name}: medication log is missing ${missing.join(", ")}`, evidence: ev, cite: cite("med") });
  }
  for (const n of day.notes) {
    const m = n.text.match(MEDS); if (!m) continue;
    if (meds.some((e) => e.noteId === n.id)) continue;
    if (/\b(no|didn't|did not|not)\b[^.]*\b(med|medicine|tylenol|motrin)/i.test(n.text)) continue;
    add({ rule: "med", level: "check", kids: day.roster.filter((c) => new RegExp(`\\b${c.name.split(" ")[0]}\\b`, "i").test(n.text)).map((c) => c.id), title: `Note mentions "${m[0]}" but no medication was logged`, detail: "If medicine was given, it needs a log entry.", evidence: [{ noteId: n.id, t: n.t, quote: n.text, verified: true }], cite: cite("med") });
  }

  // 5. Ratio over the day, minute by minute, from sign-in/out times.
  const open = dayTime(day.settings?.open ?? pack.defaults.open);
  const windows = [];
  let cur = null;
  for (let t = Math.min(open, ...Object.values(kids).map((w) => w.in ?? 9999)); t <= (close ?? 18 * 60) + 120; t++) {
    const here = Object.entries(kids).filter(([, w]) => w.in != null && w.in <= t && (w.out == null ? (endOfDay ? t < close : true) : t < w.out)).map(([id]) => id);
    if (!here.length) { if (cur) { windows.push(cur); cur = null; } continue; }
    const adultsHere = Object.entries(adults).filter(([, ws]) => ws.some((w) => (w.in ?? open) <= t && (w.out == null || t < w.out))).map(([id]) => id);
    const problem = ratioProblem(pack.ratio, here.map((id) => ageMonths(day.roster.find((c) => c.id === id), day.date)), adultsHere.length);
    const keyP = problem ? `${problem}|${adultsHere.join(",")}|${here.join(",")}` : null;
    if (cur && cur.key === keyP) { cur.end = t + 1; continue; }
    if (cur) { windows.push(cur); cur = null; }
    if (keyP) cur = { key: keyP, start: t, end: t + 1, problem, kids: here, adults: adultsHere };
  }
  if (cur) windows.push(cur);
  for (const w of windows) {
    if (w.end - w.start < (pack.ratio.graceMin ?? 1)) continue;
    const near = (e) => e.start != null && (Math.abs(e.start - w.start) <= 1 || Math.abs(e.start - w.end) <= 1);
    const staffEv = day.events.filter((e) => (e.type === "staff_in" || e.type === "staff_out") && near(e)).map((e) => ev2evidence(day, e));
    const kidEv = day.events.filter((e) => (e.type === "arrive" || e.type === "depart") && near(e)).map((e) => ev2evidence(day, e));
    add({ rule: "ratio", level: "fix", kids: w.kids, title: `${fmt(w.start)}–${fmt(w.end)}: ${w.problem}`, detail: `${w.kids.length} children (${w.kids.map((k) => `${nameOf(day, k)} ${ageLabel(ageMonths(day.roster.find((c) => c.id === k), day.date))}`).join(", ")}) with ${w.adults.length ? w.adults.map((a) => staffName(day, a)).join(" and ") : "no adult signed in"}.`, evidence: [...staffEv, ...kidEv].slice(0, 4), cite: cite("ratio") });
  }

  // 6. Attendance: every child seen today needs a sign-in and a sign-out; late pickups.
  for (const c of day.roster) {
    const w = kids[c.id];
    const seenToday = day.events.some((e) => e.kids?.includes(c.id));
    if (!seenToday) continue;
    if (w.in == null) add({ rule: "attendance", level: "fix", kids: [c.id], title: `${c.name}: no sign-in time`, detail: "Events are logged for this child but no arrival.", evidence: day.events.filter((e) => e.kids?.includes(c.id)).slice(0, 1).map((e) => ev2evidence(day, e)), cite: cite("attendance") });
    if (w.out == null && endOfDay) add({ rule: "attendance", level: "fix", kids: [c.id], title: `${c.name}: no sign-out time`, detail: "Every child needs a departure time and who picked them up.", evidence: w.inEv ? [ev2evidence(day, w.inEv)] : [], cite: cite("attendance") });
    if (w.outEv && !w.outEv.by) add({ rule: "attendance", level: "check", kids: [c.id], title: `${c.name}: who picked up at ${fmt(w.out)}?`, evidence: [ev2evidence(day, w.outEv)], cite: cite("release") });
    if (w.outEv?.by && c.pickup?.length && !pickupOk(w.outEv.by, c.pickup)) add({ rule: "attendance", level: "fix", kids: [c.id], title: `${c.name}: picked up by ${w.outEv.by}, who isn't on the pickup list`, detail: `Authorized: ${c.pickup.map((p) => `${p.name} (${p.rel})`).join(", ")}.`, evidence: [ev2evidence(day, w.outEv)], cite: cite("release") });
    const due = dayTime(c.pickupBy ?? null) ?? close;
    if (w.out != null && due != null && w.out > due) add({ rule: "late", level: "check", kids: [c.id], title: `${c.name}: late pickup, ${dur(w.out - due)} after ${fmt(due)}`, evidence: [ev2evidence(day, w.outEv)], cite: cite("late") });
  }

  // 7. Questions the reader raised instead of guessing.
  for (const q of day.questions ?? []) if (!q.answered) add({ rule: "question", level: "check", kids: [], title: q.ask, evidence: [{ noteId: q.noteId, t: noteById(day, q.noteId)?.t, quote: q.quote || noteById(day, q.noteId)?.text, verified: true }] });

  flags.sort((a, b) => sev[a.level] - sev[b.level]);
  return flags;
}

const REL = { mom: /\b(mom|mum|mommy|mother|mama|mami)\b/i, dad: /\b(dad|daddy|father|papa|papi)\b/i, grandma: /\b(grandma|grandmother|nana|abuela|granny)\b/i, grandpa: /\b(grandpa|grandfather|abuelo)\b/i };
// The pickup person must match a listed first name, or a listed relation when no other name is given.
export function pickupOk(by, list) {
  const words = by.match(/\b[A-Z][a-z]+\b/g)?.filter((w) => !/^(His|Her|Their|Mom|Dad|Grandma|Grandpa|Mommy|Daddy|Nana|Aunt|Uncle)$/.test(w)) ?? [];
  if (words.length) return words.some((w) => list.some((p) => p.name.split(" ")[0].toLowerCase() === w.toLowerCase()));
  return list.some((p) => REL[p.rel]?.test(by));
}

function label(e) { return { nap: "nap", meal: "meal", bottle: "bottle", diaper: "diaper", med: "medicine", incident: "incident", sleep_check: "sleep check", mood: "mood", activity: "activity", note: "note" }[e.type] ?? e.type; }

export function ageLabel(m) { if (m == null) return ""; return m < 24 ? `${m} mo` : `${Math.floor(m / 12)} yr`; }

function medMatch(a, b) {
  const n = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");
  const syn = { tylenol: "acetaminophen", motrin: "ibuprofen", advil: "ibuprofen", desitin: "diapercream" };
  const x = syn[n(a)] ?? n(a), y = syn[n(b)] ?? n(b);
  return x === y || x.includes(y) || y.includes(x);
}
function doseMatch(a, b) {
  const num = (s) => { const m = String(s).toLowerCase().replace(/\s/g, "").match(/(\d+(?:\.\d+)?)(ml|mg|cc|puffs?|tsp)?/); return m ? `${+m[1]}${(m[2] ?? "").replace("cc", "ml").replace(/s$/, "")}` : String(s).toLowerCase().trim(); };
  return num(a) === num(b);
}

// Ratio rule shape: per number of adults, a max total and a max count under an age.
export function ratioProblem(ratio, ages, adults) {
  if (adults === 0) return "children present, no adult signed in";
  const row = ratio.byAdults[Math.min(adults, ratio.byAdults.length - 1)];
  if (ages.length > row.total) return `${ages.length} children for ${adults} adult${adults > 1 ? "s" : ""} (limit ${row.total})`;
  for (const u of row.under ?? []) {
    const n = ages.filter((a) => a != null && a < u.months).length;
    if (n > u.max) return `${n} children under ${u.months < 24 ? `${u.months} months` : `${u.months / 12} years`} for ${adults} adult${adults > 1 ? "s" : ""} (limit ${u.max})`;
  }
  return null;
}
