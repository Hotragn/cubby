import { readFileSync } from "node:fs";
import { normalizeNote, mergeNaps } from "../public/lib/normalize.js";
import { checkDay } from "../public/lib/rules.js";
import { PACKS } from "../public/lib/states.js";
import { SAMPLE_NOTES, sampleRoster, SAMPLE_STAFF } from "../public/lib/sample.js";
import { fmt } from "../public/lib/time.js";
const rec = JSON.parse(readFileSync("public/lib/sample-extract.json", "utf8"));
console.log("wall", rec.wallMs, "in", rec.usage.inTokens, "out", rec.usage.outTokens);
const date = "2026-10-16";
const notes = SAMPLE_NOTES.map(([t, text], i) => ({ id: `N${i + 1}`, t, text }));
const day = { date, roster: sampleRoster(date), staff: SAMPLE_STAFF, notes, events: [], questions: [], reports: [] };
for (const n of notes) { const r = normalizeNote(n, rec.notes[n.id], day.roster, day.staff); day.events.push(...r.events); day.questions.push(...r.questions); }
if (process.argv[2] === "ev") for (const e of day.events) console.log(e.noteId, e.type, (e.kids??["ALL"]).join(","), e.staff??"", fmt(e.start), e.end!=null?fmt(e.end):"", e.verified?"":"UNVERIFIED", JSON.stringify({food:e.food,amount:e.amount,kind:e.kind,med:e.med,dose:e.dose,by:e.by,what:e.what}).replace(/"[a-z]+":null,?/g,""));
day.events = mergeNaps(day.events, day.questions);
const flags = checkDay(day, PACKS.MA);
for (const f of flags) console.log(f.level, f.rule, "|", f.title, "|", f.detail ?? "");
