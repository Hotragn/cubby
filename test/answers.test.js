import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeNote, mergeNaps } from "../public/lib/normalize.js";
import { checkDay } from "../public/lib/rules.js";
import { makePack } from "../public/lib/states.js";

const roster = [
  { id: "mila", name: "Mila", dob: "2026-01-10", consents: [], pickup: [{ name: "Hana Novak", rel: "mom" }], allergies: [] },
  { id: "theo", name: "Theo", dob: "2025-07-10", consents: [], pickup: [], allergies: ["peanut", "dairy"] },
];
const staff = [{ id: "rosa", name: "Rosa" }];
const baby = { id: "N1", t: "11:02", text: "the baby had a 4 oz bottle" };
// What Gemma actually returned for this note in the recorded demo (no child, plus a question).
const babyRaw = { events: [{ type: "bottle", kids: null, quote: "the baby had a 4 oz bottle", bottle: { oz: 4 } }], questions: [{ quote: "the baby", ask: "Which child is 'the baby'?" }] };

test("an unclear note becomes a question, not a guess", () => {
  const r = normalizeNote(baby, babyRaw, roster, staff);
  assert.equal(r.events.length, 0);
  assert.equal(r.questions.length, 1);
});

test("answering 'which child?' attaches the event and settles the question", () => {
  const r = normalizeNote(baby, babyRaw, roster, staff, { assign: { N1: "mila" } });
  assert.equal(r.events.length, 1);
  assert.deepEqual(r.events[0].kids, ["mila"]);
  assert.equal(r.events[0].oz, 4);
  assert.equal(r.questions.length, 0);
});

test("the alias is remembered for later notes the same day", () => {
  const later = { id: "N9", t: "15:10", text: "the baby napped 3:10 to 3:50" };
  const aliases = { "the baby": "mila" };
  // Gemma might leave the child out, or copy the nickname as the name; both map to Mila.
  const a = normalizeNote(later, { events: [{ type: "nap", kids: [], quote: "the baby napped 3:10 to 3:50", start: "3:10", end: "3:50" }] }, roster, staff, { aliases });
  const b = normalizeNote(later, { events: [{ type: "nap", kids: ["the baby"], quote: "the baby napped 3:10 to 3:50", start: "3:10", end: "3:50" }] }, roster, staff, { aliases });
  assert.deepEqual(a.events[0].kids, ["mila"]);
  assert.deepEqual(b.events[0].kids, ["mila"]);
  assert.equal(a.questions.length + b.questions.length, 0);
});

test("after the answer, rules and sheets see the event (nap needs sleep checks)", () => {
  const notes = [
    { id: "N0", t: "07:30", text: "Rosa in. Mila here w Hana" },
    { id: "N1", t: "13:00", text: "the baby down for nap 1:00" },
    { id: "N2", t: "14:00", text: "the baby up 2:00" },
  ];
  const raws = {
    N0: { events: [{ type: "staff_in", staff: "Rosa", quote: "Rosa in" }, { type: "arrive", kids: ["Mila"], quote: "Mila here w Hana", by: "Hana" }] },
    N1: { events: [{ type: "nap", kids: null, quote: "the baby down for nap 1:00", start: "1:00" }], questions: [{ quote: "the baby", ask: "Which child is 'the baby'?" }] },
    N2: { events: [{ type: "nap", kids: null, quote: "the baby up 2:00", end: "2:00" }], questions: [{ quote: "the baby", ask: "Which child is 'the baby'?" }] },
  };
  const run = (ctx) => {
    const day = { date: "2026-10-18", roster, staff, notes, events: [], questions: [], reports: [] };
    for (const n of notes) { const r = normalizeNote(n, raws[n.id], roster, staff, ctx); day.events.push(...r.events); day.questions.push(...r.questions); }
    day.events = mergeNaps(day.events, day.questions);
    return checkDay(day, makePack({ state: "MA" }), { endOfDay: false });
  };
  const before = run({});
  assert.ok(!before.some((f) => f.rule === "sleep"));
  assert.ok(before.some((f) => f.rule === "question"));
  // Answer once for N1; the alias carries to N2 without a second answer.
  const after = run({ assign: { N1: "mila" }, aliases: { "the baby": "mila" } });
  assert.ok(after.some((f) => f.rule === "sleep" && f.kids.includes("mila")), "unchecked hour-long nap is now flagged");
  assert.ok(!after.some((f) => f.rule === "question"));
});

test("the provider's own settings drive the rules", () => {
  const day = { date: "2026-10-18", roster, staff, events: [], questions: [], reports: [], notes: [{ id: "N1", t: "12:00", text: "lunch mac and cheese, Theo ate all" }] };
  const r = normalizeNote(day.notes[0], { events: [{ type: "meal", kids: ["Theo"], quote: "lunch mac and cheese, Theo ate all", food: "mac and cheese", amount: "all", meal: "lunch" }] }, roster, staff);
  day.events = r.events;
  const flags = checkDay(day, makePack({ state: "MA" }), { endOfDay: false });
  assert.ok(flags.some((f) => f.rule === "allergy" && f.kids.includes("theo")), "dairy allergy matches mac and cheese");
  const strict = makePack({ state: "MA", settings: { sleepEvery: 10 } });
  assert.equal(strict.sleep.everyMin, 10);
});
