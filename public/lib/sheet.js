// Parent daily sheet. Code builds the facts from checked events; a model may only
// re-word them, and the re-worded text is checked against the facts before use.

import { fmt, dur } from "./time.js";

const AMT = { all: "ate all of it", most: "ate most of it", half: "ate about half", some: "ate some", little: "had a few bites", none: "didn't eat it" };
const he = (c) => c.name;

export function sheetFacts(day, kid) {
  const c = day.roster.find((r) => r.id === kid);
  const mine = day.events.filter((e) => e.kids?.includes(kid)).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const facts = [];
  // A plain "lunch: pasta" next to "Ava ate all her pasta" at the same time says the same thing once.
  const isDup = (e) => e.type === "meal" && !e.amount && mine.some((o) => o !== e && o.type === "meal" && o.amount && o.start === e.start);
  const arr = mine.find((e) => e.type === "arrive");
  if (arr) facts.push({ k: "arrive", t: arr.start, text: `Arrived at ${fmt(arr.start)}${arr.by ? `, dropped off by ${arr.by}` : ""}.` });
  for (const e of mine) {
    if (isDup(e)) continue;
    if (e.type === "meal") facts.push({ k: "meal", t: e.start, text: `${cap(e.meal ?? "Meal")} at ${fmt(e.start)}: ${e.food ?? "food not noted"}${e.amount ? `, ${AMT[e.amount]}` : ""}.` });
    if (e.type === "bottle") facts.push({ k: "meal", t: e.start, text: `Bottle at ${fmt(e.start)}${e.oz != null ? `: ${e.oz} oz` : ""}${e.food ? ` of ${e.food}` : ""}.` });
    if (e.type === "nap" && e.start != null) facts.push({ k: "nap", t: e.start, text: e.end != null ? `Nap from ${fmt(e.start)} to ${fmt(e.end)} (${dur(e.end - e.start)}).` : `Went down for a nap at ${fmt(e.start)}.` });
    if (e.type === "diaper") facts.push({ k: "diaper", t: e.start, text: e.toilet ? `Used the potty at ${fmt(e.start)}${e.kind ? ` (${e.kind === "bm" ? "BM" : e.kind})` : ""}.` : `Diaper at ${fmt(e.start)}: ${e.kind === "bm" ? "BM" : e.kind ?? "changed"}.` });
    if (e.type === "med") facts.push({ k: "med", t: e.start, text: `Medicine: ${e.med ?? "?"} ${e.dose ?? ""} at ${fmt(e.start)}${e.by ? `, given by ${e.by}` : ""}.`.replace(/\s+/g, " ") });
    if (e.type === "incident") {
      const rep = (day.reports ?? []).find((r) => r.kid === kid && r.noteId === e.noteId && r.status === "done");
      facts.push({ k: "incident", t: e.start, text: `At ${fmt(e.start)}: ${e.what ?? "an incident"}${e.action ? `. Care given: ${e.action}` : ""}. ${rep ? "A written incident report is attached." : "Incident report to follow."}` });
    }
    if (e.type === "mood" && e.mood) facts.push({ k: "mood", t: e.start, text: `Mood: ${e.mood}.` });
    if (e.type === "activity" && e.what) facts.push({ k: "activity", t: e.start, text: `Played: ${e.what}.` });
  }
  const dep = [...mine].reverse().find((e) => e.type === "depart");
  if (dep) facts.push({ k: "depart", t: dep.start, text: `Went home at ${fmt(dep.start)}${dep.by ? ` with ${dep.by}` : ""}.` });
  return { child: c, facts };
}

// Injuries and medicine are never re-worded by a model: they stay exactly as code wrote them.
export const FIXED = new Set(["incident", "med"]);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- grounding check for model-written text

const RISKY = ["fever", "sick", "ill", "vomit", "vomited", "threw up", "rash", "cough", "diarrhea", "cold", "allergic", "allergy", "hurt", "injury", "injured", "cried", "crying", "bump", "bumped", "bit", "bite", "bitten", "fell", "fall", "blood", "bruise", "scratch", "tylenol", "motrin", "ibuprofen", "acetaminophen", "medicine", "medication", "cream", "pizza", "chicken", "fish", "rice", "pasta", "apple", "banana", "bananas", "cheese", "milk", "formula", "eggs", "yogurt", "sandwich", "soup", "carrot", "carrots", "peas", "oatmeal", "crackers", "cookie", "cake", "juice", "nuts", "peanut", "potty", "toilet", "diaper", "nap", "slept", "outside", "park", "walk", "painting", "playdough", "blocks", "puzzle", "music", "book", "books"];

function timesIn(s) {
  return [...String(s).toLowerCase().matchAll(/\b(\d{1,2})[:h.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?/g)].map((m) => `${+m[1] % 12}:${m[2]}`);
}
function numsIn(s) {
  return [...String(s).replace(/\b\d{1,2}[:h.]\d{2}\b/g, " ").matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((m) => m[0].replace(",", "."));
}

export function groundCheck(text, facts, lang = "English") {
  const src = facts.map((f) => f.text).join(" \n ");
  const problems = [];
  const okTimes = new Set(timesIn(src));
  for (const t of timesIn(text)) if (!okTimes.has(t)) problems.push(`time ${t} isn't in the log`);
  const okNums = new Set(numsIn(src));
  for (const n of numsIn(text)) if (!okNums.has(n)) problems.push(`number ${n} isn't in the log`);
  if (lang === "English") {
    const low = " " + text.toLowerCase().replace(/[^a-z\s']/g, " ") + " ";
    const lowSrc = " " + src.toLowerCase().replace(/[^a-z\s']/g, " ") + " ";
    for (const w of RISKY) {
      const re = new RegExp(`\\s${w}\\s`);
      if (re.test(low) && !lowSrc.includes(w.slice(0, Math.max(4, w.length - 2)))) problems.push(`"${w}" isn't in the log`);
    }
  } else {
    // Other languages: medicine names must still be ones in the log.
    for (const m of ["tylenol", "motrin", "ibuprofen", "acetaminophen", "benadryl"]) if (text.toLowerCase().includes(m) && !src.toLowerCase().includes(m)) problems.push(`"${m}" isn't in the log`);
  }
  return { ok: problems.length === 0, problems };
}
