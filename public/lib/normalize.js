// Turns Gemma's JSON for one note into checked events. Nothing the model says is
// trusted until it passes here: names must be on the roster, times must parse, and
// the quote must really appear in the note. Anything that fails becomes a question.

import { dayTime } from "./time.js";

export const TYPES = ["arrive", "depart", "staff_in", "staff_out", "meal", "bottle", "nap", "sleep_check", "diaper", "incident", "med", "mood", "activity", "note"];
const AMOUNTS = ["all", "most", "half", "some", "little", "none"];

const squash = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9':.\s]/g, " ").replace(/\s+/g, " ").trim();

export { squash };
export function quoteInNote(quote, text) {
  if (!quote) return false;
  return squash(text).includes(squash(quote));
}

function findPerson(name, people, aliases) {
  const n = squash(name);
  if (!n) return null;
  if (aliases?.[n]) return people.find((p) => p.id === aliases[n]) ?? null;
  return people.find((p) => squash(p.name) === n) ?? people.find((p) => squash(p.name).split(" ")[0] === n.split(" ")[0]) ?? null;
}

// "now", "just now" or nothing → the time the note was logged, marked as such.
function readTime(v, note, fallback = true) {
  if (v == null || v === "") return fallback ? { t: dayTime(note.t), src: "logged" } : { t: null, src: "missing" };
  if (/^(now|just now|just)$/i.test(String(v).trim())) return { t: dayTime(note.t), src: "logged" };
  const t = dayTime(v);
  return t == null ? { t: null, src: "unreadable" } : { t, src: "stated" };
}

let seq = 0;
// ctx.aliases: {"the baby": "mila"} learned from answers today.
// ctx.assign: {noteId: childId} set when the provider answers "which child?" for a note.
export function normalizeNote(note, raw, roster, staff, ctx = {}) {
  const aliases = ctx.aliases ?? {}, assigned = ctx.assign?.[note.id];
  const events = [], questions = [];
  const list = Array.isArray(raw?.events) ? raw.events : [];
  for (let e of list) {
    if (!e || !TYPES.includes(e.type)) continue;
    // Gemma sometimes nests the fields under the type ({"type":"nap","nap":{"start":..}}); flatten it.
    if (e[e.type] && typeof e[e.type] === "object" && !Array.isArray(e[e.type])) e = { ...e[e.type], ...e, [e.type]: undefined };
    const ev = { id: `${note.id}-e${++seq}`, type: e.type, noteId: note.id, quote: String(e.quote ?? "").slice(0, 240), kids: [], flags: [] };
    ev.verified = quoteInNote(ev.quote, note.text);

    if (e.type === "staff_in" || e.type === "staff_out") {
      const s = findPerson(e.staff ?? (e.kids?.[0]), staff);
      if (!s) { questions.push({ noteId: note.id, quote: ev.quote, ask: `Who is "${e.staff ?? "?"}"? They are not on the staff list.` }); continue; }
      ev.staff = s.id;
    } else {
      let names = (Array.isArray(e.kids) ? e.kids : e.kids ? [e.kids] : []).filter((n) => n != null && n !== "" && n !== "null");
      // A nickname learned today ("the baby") counts even when the model left the child out.
      if (!names.length) { const hit = Object.keys(aliases).find((a) => squash(ev.quote || note.text).includes(a)); if (hit) names = [hit]; }
      if (!names.length && /\b(all|everyone|everybody|all kids|all the kids)\b/i.test(ev.quote || "")) names = ["all"];
      for (const n of names) {
        if (/^(all|everyone|everybody|the kids|all kids)$/i.test(String(n).trim())) { ev.all = true; continue; }
        const c = findPerson(n, roster, aliases);
        if (c) ev.kids.push(c.id);
        else if (assigned) ev.kids.push(assigned);
        else questions.push({ noteId: note.id, quote: ev.quote, ask: `Who is "${n}"? No child by that name on today's roster.`, phrase: String(n) });
      }
      // "all" only counts when the note says so; otherwise it's the model filling a gap.
      if (ev.all && !/\b(all|everyone|everybody|kids|children|whole group)\b/i.test(ev.quote || note.text)) { if (list.length > 1) continue; questions.push({ noteId: note.id, quote: ev.quote, ask: "Which children is this about?" }); continue; }
      if (ev.all) ev.kids = null; // resolved later to "everyone present at that time"
      else if (!ev.kids.length && assigned) ev.kids = [assigned];
      else if (!ev.kids.length) { if (e.type !== "note" && !(raw?.questions ?? []).length) questions.push({ noteId: note.id, quote: ev.quote, ask: `Which child is this about?` }); continue; }
      if (ev.kids) ev.kids = [...new Set(ev.kids)];
      if (assigned && ev.kids.includes(assigned)) ev.answered = true;
    }

    if (e.type === "nap") {
      // "Theo up at 2:20" is a nap end with no start; mergeNaps() pairs it with the open nap.
      const endOnly = (e.start == null || e.start === "") && e.end != null && e.end !== "";
      const a = endOnly ? { t: null, src: "missing" } : readTime(e.start, note), b = readTime(e.end, note, false);
      ev.start = a.t; ev.end = b.t; ev.timeSrc = a.src; ev.endOnly = endOnly;
    } else {
      // No time in the words → the time the note was logged (shown as "logged" in the app).
      const a = readTime(e.time, note);
      ev.start = a.t; ev.timeSrc = a.src;
    }

    const str = (v) => (v == null || v === "" ? null : String(v).slice(0, 120));
    switch (e.type) {
      case "meal": ev.food = str(e.food); ev.meal = str(e.meal); ev.amount = AMOUNTS.includes(String(e.amount).toLowerCase()) ? String(e.amount).toLowerCase() : null; break;
      case "bottle": ev.oz = Number.isFinite(+e.oz) && e.oz !== null && e.oz !== "" ? +e.oz : null; ev.food = str(e.food); break;
      case "diaper": ev.kind = ["wet", "bm", "dry", "wet+bm"].includes(e.kind) ? e.kind : str(e.kind); ev.toilet = !!e.toilet; break;
      case "incident": ev.what = str(e.what); ev.body = str(e.body); ev.action = str(e.action); ev.by = str(e.by); break;
      case "med": ev.med = str(e.med); ev.dose = str(e.dose); ev.by = str(e.by); break;
      case "sleep_check": ev.by = str(e.by); ev.position = str(e.position); break;
      case "depart": case "arrive": ev.by = str(e.by); break;
      case "mood": ev.mood = str(e.mood); break;
      case "activity": ev.what = str(e.what); break;
      case "note": ev.what = str(e.what); break;
    }
    events.push(ev);
  }
  for (const q of Array.isArray(raw?.questions) ? raw.questions : []) {
    if (!q?.ask) continue;
    // Once the provider has said which child a note is about, "which child?" questions on it are settled.
    if (assigned && /which (child|kid)|who is|whose|which (children|kids)/i.test(q.ask)) continue;
    // Gemma sometimes extracts "checked all 1:40" correctly and still asks which children; the note said all.
    if (events.length && events.every((e) => e.all || e.kids?.length || e.staff) && /which (child|kid|children|kids)/i.test(q.ask) && /\b(all|everyone|everybody)\b/i.test(note.text)) continue;
    const phrase = String(q.ask).match(/["“'‘]([^"”'’]{2,30})["”'’]/)?.[1];
    if (phrase && aliases[squash(phrase)]) continue;
    questions.push({ noteId: note.id, quote: String(q.quote ?? "").slice(0, 240), ask: String(q.ask).slice(0, 200), fromModel: true, phrase });
  }
  return { events, questions };
}

// Pairs "down for nap 12:20" with a later "up at 2:20" for the same child. An end with no
// open nap becomes a question instead of a guessed start.
export function mergeNaps(events, questions) {
  const out = [];
  const sorted = [...events].sort((a, b) => (a.start ?? a.end ?? 0) - (b.start ?? b.end ?? 0));
  for (const e of sorted) {
    if (e.type !== "nap" || !e.endOnly) { out.push(e); continue; }
    // "everyone up 2:15" closes every open nap that started before it.
    const who = e.kids ?? [...new Set(out.filter((n) => n.type === "nap" && n.end == null && n.start != null && n.start < e.end).flatMap((n) => n.kids ?? []))];
    for (const k of who) {
      const open = out.filter((n) => n.type === "nap" && n.kids?.includes(k) && n.end == null && n.start != null && n.start < e.end).pop();
      if (open) {
        if (open.kids.length > 1) { // split a shared nap so each child keeps their own wake time
          open.kids = open.kids.filter((x) => x !== k);
          out.push({ ...open, id: open.id + "-" + k, kids: [k], end: e.end, endNoteId: e.noteId, endQuote: e.quote });
        } else { open.end = e.end; open.endNoteId = e.noteId; open.endQuote = e.quote; }
      } else questions?.push({ noteId: e.noteId, quote: e.quote, ask: "When did this nap start?" });
    }
  }
  return out;
}
