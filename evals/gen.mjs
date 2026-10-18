// SYNTHETIC test days. Every child, adult and note is invented by this script.
// Each day is a plausible home-daycare day written in quick-note style, with problems
// planted on purpose. The answer key (planted) is written before any model sees a note.
// Run: node evals/gen.mjs  → evals/days/day-XX.json

import { writeFileSync, mkdirSync } from "node:fs";

let seed = +(process.env.SEED ?? 20261018);
const OUT = process.env.OUT ?? "evals/days";
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const chance = (p) => rnd() < p;
const hm = (m) => `${Math.floor(m / 60) > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const NAMES = ["Nora", "Eli", "Zoe", "Omar", "Ivy", "Mateo", "Priya", "Finn", "Lucia", "Kai", "Amara", "Jonah", "Sofia", "Ezra", "Hazel", "Ravi", "June", "Tomas", "Wren", "Idris", "Maya", "Felix", "Leila", "Otto"];
const ADULTS = ["Gloria", "Bea", "Marcus", "Tia", "Joy", "Ana"];
const SURNAMES = ["Alvarez", "Brooks", "Chen", "Dube", "Ellis", "Farah", "Greer", "Hale", "Ito", "Jansen", "Khan", "Lund"];
const PARENTS = ["Kim", "Luis", "Dee", "Sam", "Rita", "Paolo", "Jen", "Malik", "Ines", "Tom", "Ada", "Hugo"];
const FOODS = { breakfast: ["oatmeal and berries", "toast and eggs", "cheerios and milk", "yogurt and banana", "waffles"], lunch: ["chicken and rice", "mac and cheese", "pasta with peas", "turkey wraps", "bean soup", "fish sticks and corn"], snack: ["apple slices", "crackers and cheese", "goldfish", "pear and cheese", "rice cakes"] };
const AMT = [["ate all", "all"], ["cleaned the plate", "all"], ["ate most", "most"], ["ate half", "half"], ["had a few bites", "little"], ["didn't touch it", "none"]];
const ACTS = ["painting at the easel", "sandbox outside", "story time", "blocks and trains", "bubbles in the yard", "music and dancing", "playdough", "walk to the park"];

const date = "2026-10-14";
function dob(months) { const d = new Date(date + "T12:00:00"); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() - 3); return d.toISOString().slice(0, 10); }

function makeDay(n, plan) {
  const names = [...NAMES].sort(() => rnd() - 0.5).slice(0, plan.kids);
  const ages = plan.ages ?? names.map(() => pick([7, 10, 13, 17, 20, 26, 31, 38, 44, 52]));
  const roster = names.map((name, i) => ({ id: name.toLowerCase(), name, dob: dob(ages[i]), pickup: [{ name: `${pick(PARENTS)} ${pick(SURNAMES)}`, rel: pick(["mom", "dad"]) }], consents: [] }));
  const staff = [{ id: "p", name: plan.provider ?? pick(ADULTS.slice(0, 3)) }];
  if (plan.assistant) staff.push({ id: "a", name: plan.assistant });
  const notes = [], planted = [];
  const N = (t, text) => notes.push([hh(t), text]);
  const P = (rule, kid, what) => planted.push({ rule, kid, what });
  const kids = roster.map((c, i) => ({ ...c, age: ages[i] }));

  // sign-ins
  N(410 + Math.floor(rnd() * 15), `${staff[0].name} in`);
  let t = 430;
  for (const c of kids) {
    t += 4 + Math.floor(rnd() * 14);
    if (plan.noSignIn === c.name) continue;
    N(t, pick([`${c.name} here`, `${c.name} dropped off by ${c.pickup[0].rel}`, `${c.name} in w ${c.pickup[0].rel}`, `${c.name} arrived ${hm(t)}`]));
  }
  if (plan.assistant) N(480, `${plan.assistant} in`);

  // breakfast
  const bf = pick(FOODS.breakfast);
  const eaters = kids.filter((c) => c.age >= 12);
  N(510, `breakfast ${bf}. ` + eaters.map((c) => { const [p] = pick(AMT); return `${c.name} ${p}`; }).join(", "));
  for (const c of kids.filter((c) => c.age < 12)) N(515, `${c.name} ${pick(["4", "5", "6"])} oz bottle`);

  // diapers / potty
  N(560, kids.filter((c) => c.age < 36).map((c) => `${c.name} ${pick(["wet", "wet", "BM"])}`).join(", ") + " diapers");
  const big = kids.filter((c) => c.age >= 36);
  if (big.length) N(565, `${big[0].name} used the potty`);

  // morning activity + distractors that are NOT problems
  N(600, `${pick(ACTS)}, ${kids.slice(0, 2).map((c) => c.name).join(" and ")} loved it`);
  if (plan.distract) for (const d of plan.distract) N(d[0], d[1]);

  // planted extras before lunch (incidents, meds)
  for (const x of plan.extra ?? []) { if (x.text) N(x.t, x.text); if (x.rule) P(x.rule, x.kid, x.what ?? x.text); }

  // lunch
  const lf = pick(FOODS.lunch);
  N(690, `lunch ${lf}. ` + eaters.map((c) => { const [p] = pick(AMT); return `${c.name} ${p}`; }).join(", "));

  // naps with sleep checks every 15 min (named children)
  const nappers = kids.filter((c) => c.age < 48);
  const start = 750, end = 870;
  if (plan.badNap) { const c = nappers[0]; N(880, `${c.name} napped ${hm(plan.badNap[0])} to ${hm(plan.badNap[1])}`); P("time", c.id, `nap ends before it starts`); }
  N(start + 2, `${nappers.map((c) => c.name).join(", ")} down for nap ${hm(start)}`);
  for (let ct = start + 15; ct < end; ct += 15) {
    let who = nappers.filter((c) => !(plan.gap && plan.gap.kid === c.name && ct > plan.gap.from && ct < plan.gap.to));
    if (!who.length) continue;
    N(ct, pick([`checked ${who.map((c) => c.name).join(", ")} ${hm(ct)}`, `sleep check ${hm(ct)} ${who.map((c) => c.name).join(" ")} ok on backs`, `${hm(ct)} check: ${who.map((c) => c.name).join(", ")} sleeping`]));
  }
  if (plan.gap) P("sleep", plan.gap.kid.toLowerCase(), `no checks on ${plan.gap.kid} ${hm(plan.gap.from)}-${hm(plan.gap.to)}`);
  N(end + 1, `${nappers.map((c) => c.name).join(", ")} up at ${hm(end)}`);

  // snack
  N(905, `snack ${pick(FOODS.snack)}, everyone ate ${pick(["most", "all of it", "some"])}`);

  // assistant leaves (ratio)
  if (plan.assistant && plan.assistantOut) { N(plan.assistantOut[0], `${plan.assistant} out`); if (plan.assistantOut[1]) N(plan.assistantOut[1], `${plan.assistant} back`); }
  if (plan.ratio) P("ratio", null, plan.ratio);

  // departures
  let d = 960;
  for (const c of kids) {
    d = Math.min(d + 8 + Math.floor(rnd() * 15), 1045); // everyone out by 5:25 unless a late pickup is planted
    if (plan.noSignOut === c.name) { P("attendance", c.id, "no sign-out"); continue; }
    if (plan.stranger === c.name) { N(d, `${c.name} picked up by ${plan.strangerName}`); P("attendance", c.id, `picked up by ${plan.strangerName}, not on list`); continue; }
    if (plan.late === c.name) { N(1075, `${c.name} picked up ${hm(1072)} by ${c.pickup[0].rel}, traffic`); P("late", c.id, "picked up 5:52"); continue; }
    N(d, pick([`${c.name} picked up by ${c.pickup[0].rel}`, `${c.name} home w ${c.pickup[0].name.split(" ")[0]}`, `${c.name} out ${hm(d)}, ${c.pickup[0].rel}`]));
  }
  if (plan.noSignIn) P("attendance", plan.noSignIn.toLowerCase(), "no sign-in");
  if (plan.assistant && plan.assistantOut?.[1] == null) {} else if (plan.assistant) N(1050, `${plan.assistant} out`);

  for (const c of plan.consents ?? []) roster.find((r) => r.name === c.kid).consents.push({ med: c.med, dose: c.dose, until: c.until ?? "2026-12-31" });
  notes.sort((a, b) => a[0].localeCompare(b[0]));
  return { synthetic: true, id: `day-${String(n).padStart(2, "0")}`, date, state: "MA", settings: { open: "7:00", close: "17:30" }, roster, staff, notes: notes.map(([t, text], i) => ({ id: `N${i + 1}`, t, text })), planted };
}

const days = [
  // 1. clean day: nothing planted, a few look-alike phrases
  { kids: 4, ages: [10, 20, 30, 40], distract: [[620, "Eli fell asleep in the reading nook for a minute, woke right up"], [640, "pretend doctor kit, Zoe gave everyone 'medicine'"]] },
  // 2. incident + missing sign-out
  { kids: 4, ages: [9, 22, 34, 45], extra: [{ t: 620, text: "KID0 tripped on the rug and scraped her knee, washed it, bandaid", rule: "incident", kidIdx: 0 }], noSignOutIdx: 2 },
  // 3. ratio: assistant out with 4 under-2s
  { kids: 4, ages: [8, 13, 18, 22], assistant: "Bea", assistantOut: [910, 960], ratio: "4 under 2 with one adult" },
  // 4. medication without consent + med missing dose (consent on file)
  { kids: 5, ages: [11, 19, 27, 35, 50], extra: [{ t: 630, text: "gave KID1 motrin 2.5 ml for teething", rule: "med", kidIdx: 1, what: "no consent" }, { t: 700, text: "KID3 had her zyrtec", rule: "med", kidIdx: 3, what: "no dose, no time stated, no giver" }], consentsIdx: [{ i: 3, med: "Zyrtec", dose: "2.5 ml" }] },
  // 5. sleep gap + late pickup
  { kids: 4, ages: [7, 16, 28, 39], gapIdx: { i: 0, from: 770, to: 830 }, lateIdx: 2 },
  // 6. hidden injury (no 'incident' word) + unauthorized pickup
  { kids: 4, ages: [12, 24, 33, 47], extra: [{ t: 645, text: "KID2 has a goose egg on his forehead after the slide, ice pack", rule: "incident", kidIdx: 2 }], strangerIdx: 1, strangerName: "his uncle Dev" },
  // 7. impossible nap time + no sign-in + bite
  { kids: 5, ages: [10, 17, 25, 36, 44], badNap: [870, 790], noSignInIdx: 4, extra: [{ t: 660, text: "KID1 bit KID2 on the hand, left a mark, talked about gentle hands", rule: "incident", kidIdx: 2, what: "bitten" }, { t: 660, text: null, rule: "incident", kidIdx: 1, what: "biter: behavior incident record (7.11(5)(f))" }] },
  // 8. ratio over total (7 kids, 1 adult) + expired consent
  { kids: 7, ages: [14, 20, 26, 30, 38, 46, 55], assistant: "Tia", assistantOut: [600, 650], ratio: "7 children with one adult", extra: [{ t: 720, text: "gave KID4 tylenol 5 ml at 12, fever 100.2, Gloria", rule: "med", kidIdx: 4, what: "consent expired" }], consentsIdx: [{ i: 4, med: "Tylenol", dose: "5 ml", until: "2026-10-07" }] },
  // 9. dose mismatch + sleep gap on second child
  { kids: 4, ages: [9, 15, 29, 41], extra: [{ t: 640, text: "KID2 got 7.5 ml amoxicillin at 10:40, Gloria gave it", rule: "med", kidIdx: 2, what: "dose differs from consent" }], consentsIdx: [{ i: 2, med: "Amoxicillin", dose: "5 ml" }], gapIdx: { i: 1, from: 785, to: 845 } },
  // 10. clean day with look-alikes
  { kids: 5, ages: [11, 21, 31, 42, 50], distract: [[615, "Felix bit into his apple and said it was the best ever"], [700, "talked about the doctor visit Maya had last week, she showed us her bandaid sticker book"]] },
  // 11. multiple: incident, missing sign-out, late pickup
  { kids: 5, ages: [8, 18, 28, 37, 49], extra: [{ t: 610, text: "KID3 fell off the little chair, bumped his chin, cold cloth, Gloria saw", rule: "incident", kidIdx: 3 }], noSignOutIdx: 1, lateIdx: 4 },
  // 12. med given with nothing but name, by assistant; ratio with 2 adults but too many infants
  { kids: 6, ages: [6, 9, 12, 14, 30, 44], assistant: "Joy", assistantOut: [900, null], ratio: "after Joy leaves: 4 under 2 with one adult", extra: [{ t: 655, text: "KID0 diaper cream at the 10:55 change", rule: null }], consentsIdx: [{ i: 0, med: "Diaper cream", dose: "thin layer" }] },
];

mkdirSync(OUT, { recursive: true });
let total = 0;
days.forEach((spec, i) => {
  // Resolve KIDn placeholders after names are drawn.
  const s0 = seed;
  const preview = makeDay(i + 1, { ...spec, extra: [] });
  seed = s0;
  const name = (k) => preview.roster[k].name;
  const plan = { ...spec };
  plan.extra = (spec.extra ?? []).map((x) => ({ ...x, text: x.text && x.text.replace(/KID(\d)/g, (_, k) => name(+k)), kid: x.kidIdx != null ? preview.roster[x.kidIdx].id : null }));
  if (spec.noSignOutIdx != null) plan.noSignOut = name(spec.noSignOutIdx);
  if (spec.noSignInIdx != null) plan.noSignIn = name(spec.noSignInIdx);
  if (spec.lateIdx != null) plan.late = name(spec.lateIdx);
  if (spec.strangerIdx != null) plan.stranger = name(spec.strangerIdx);
  if (spec.gapIdx) plan.gap = { kid: name(spec.gapIdx.i), from: spec.gapIdx.from, to: spec.gapIdx.to };
  if (spec.consentsIdx) plan.consents = spec.consentsIdx.map((c) => ({ kid: name(c.i), med: c.med, dose: c.dose, until: c.until }));
  const day = makeDay(i + 1, plan);
  total += day.planted.length;
  writeFileSync(`${OUT}/${day.id}.json`, JSON.stringify(day, null, 1));
  console.log(day.id, day.roster.length, "kids", day.notes.length, "notes", day.planted.map((p) => `${p.rule}:${p.kid ?? "-"}`).join(" "));
});
console.log("planted total", total);
