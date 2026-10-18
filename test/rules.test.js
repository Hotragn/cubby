import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeNote, mergeNaps } from "../public/lib/normalize.js";
import { checkDay, ratioProblem } from "../public/lib/rules.js";
import { PACKS } from "../public/lib/states.js";
import { SAMPLE_NOTES, sampleRoster, SAMPLE_STAFF, PLANTED } from "../public/lib/sample.js";
import { dayTime } from "../public/lib/time.js";
import { groundCheck } from "../public/lib/sheet.js";

function sample() {
  const rec = JSON.parse(readFileSync(new URL("../public/lib/sample-extract.json", import.meta.url)));
  const date = "2026-10-16";
  const notes = SAMPLE_NOTES.map(([t, text], i) => ({ id: `N${i + 1}`, t, text }));
  const day = { date, roster: sampleRoster(date), staff: SAMPLE_STAFF, notes, events: [], questions: [], reports: [] };
  for (const n of notes) { const r = normalizeNote(n, rec.notes[n.id], day.roster, day.staff); day.events.push(...r.events); day.questions.push(...r.questions); }
  day.events = mergeNaps(day.events, day.questions);
  return day;
}

test("every planted problem in the demo day is flagged", () => {
  const flags = checkDay(sample(), PACKS.MA);
  for (const p of PLANTED) assert.ok(flags.some((f) => f.rule === p.rule && (p.kid == null || f.kids?.includes(p.kid))), p.what);
});

test("a finished incident report clears its flag", () => {
  const day = sample();
  const n = day.events.find((e) => e.type === "incident" && e.kids.includes("theo"));
  day.reports.push({ kid: "theo", noteId: n.noteId, status: "done", time: "10:20" });
  assert.ok(!checkDay(day, PACKS.MA).some((f) => f.rule === "incident" && f.kids.includes("theo")));
});

test("MA ratio: 4 under-2s with one adult is over, 3 is fine", () => {
  assert.match(ratioProblem(PACKS.MA.ratio, [9, 15, 20, 23], 1), /4 children under 2/);
  assert.equal(ratioProblem(PACKS.MA.ratio, [9, 15, 20, 40], 1), null);
  assert.match(ratioProblem(PACKS.MA.ratio, [30, 30, 30, 30, 30, 30, 30], 1), /7 children/);
});

test("clock times read the way providers write them", () => {
  assert.equal(dayTime("1:10"), 13 * 60 + 10);
  assert.equal(dayTime("06:59"), 6 * 60 + 59);
  assert.equal(dayTime("110"), 13 * 60 + 10);
  assert.equal(dayTime("9:45"), 9 * 60 + 45);
});

test("food bites and falling asleep are not injuries", () => {
  const day = { date: "2026-10-16", roster: [{ id: "a", name: "Ava", dob: "2024-01-01", consents: [], pickup: [] }], staff: [], events: [], questions: [], reports: [],
    notes: [{ id: "N1", t: "08:00", text: "Ava had a few bites of toast" }, { id: "N2", t: "12:00", text: "Ava fell asleep fast" }, { id: "N3", t: "13:00", text: "Ava bit into her apple" }] };
  assert.ok(!checkDay(day, PACKS.MA, { endOfDay: false }).some((f) => f.rule === "incident"));
});

test("a warm sheet that adds a time or a food is rejected", () => {
  const facts = [{ text: "Nap from 1:10 pm to 2:40 pm (1 hr 30 min)." }, { text: "Lunch at 11:45 am: pasta, ate all of it." }];
  assert.equal(groundCheck("She napped from 1:10 to 2:40 and loved her pasta.", facts).ok, true);
  assert.equal(groundCheck("She napped from 1:10 to 3:00.", facts).ok, false);
  assert.equal(groundCheck("She ate pasta and a cookie.", facts).ok, false);
});
