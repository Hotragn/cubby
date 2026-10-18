// Scores Cubby on the SYNTHETIC days in evals/days against their planted answer keys.
//   node evals/run.ts pipeline   Gemma reads notes → code checks rules (Cubby)
//   node evals/run.ts baseline   Gemma alone, given the same notes, roster and rules, asked to list problems
//   GEMMA_LOCAL=1 node evals/run.ts pipeline   same pipeline on Gemma 4 E4B via Ollama on this machine
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { extract, callGemma, newUsage, MODEL, LOCAL } = await import("../src/gemma.ts");
const { normalizeNote, mergeNaps } = await import("../public/lib/normalize.js");
const { checkDay, ageMonths } = await import("../public/lib/rules.js");
const { PACKS } = await import("../public/lib/states.js");

const mode = process.argv[2] ?? "pipeline";
const only = process.argv[3];
const DIR = process.env.DAYS ?? "evals/days";
const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only || f.includes(only))).sort();
const pack = PACKS.MA;
const SCORED = ["sleep", "incident", "med", "ratio", "attendance", "late", "time"];

function score(day: any, found: { rule: string; kids: string[]; title: string }[]) {
  const caught: any[] = [], missed: any[] = [];
  const used = new Set<number>();
  for (const p of day.planted) {
    const i = found.findIndex((f) => f.rule === p.rule && (p.kid == null || f.kids.includes(p.kid)));
    if (i >= 0) { caught.push(p); used.add(i); } else missed.push(p);
  }
  // A flag that matches some planted item (even one already counted) is not a false alarm.
  const falseAlarms = found.filter((f, i) => !used.has(i) && !day.planted.some((p: any) => p.rule === f.rule && (p.kid == null || f.kids.includes(p.kid))));
  return { caught, missed, falseAlarms };
}

async function pipeline(day: any) {
  const usage = newUsage(); const t0 = Date.now();
  const raw = await extract(day.notes, day.roster, day.staff, usage);
  const wallMs = Date.now() - t0;
  const d: any = { ...day, events: [], questions: [], reports: [] };
  for (const n of day.notes) { const r = normalizeNote(n, raw[n.id], day.roster, day.staff); d.events.push(...r.events); d.questions.push(...r.questions); }
  d.events = mergeNaps(d.events, d.questions);
  const flags = checkDay(d, pack);
  const found = flags.filter((f: any) => SCORED.includes(f.rule)).map((f: any) => ({ rule: f.rule, kids: f.kids ?? [], title: f.title }));
  return { found, usage, wallMs, questions: d.questions.length, unverified: d.events.filter((e: any) => !e.verified).length, events: d.events.length };
}

async function baseline(day: any) {
  const usage = newUsage(); const t0 = Date.now();
  const roster = day.roster.map((c: any) => `- ${c.name}, ${ageMonths(c, day.date)} months old. Authorized pickup: ${c.pickup.map((p: any) => `${p.name} (${p.rel})`).join(", ")}. Medication consents on file: ${c.consents.length ? c.consents.map((m: any) => `${m.med} ${m.dose}, valid until ${m.until}`).join("; ") : "none"}.`).join("\n");
  const prompt = `You are checking a Massachusetts home daycare's notes for one day (${day.date}) against licensing rules. Find every problem.
Rules:
- Ratio (606 CMR 7.10(4)): one adult may have at most 6 children, of whom at most 3 are under 2 years old. Two adults: at most 10 children, at most 6 under 2 and at most 3 under 15 months. Count adults from their sign-in/sign-out notes.
- Sleep checks (7.10(7)(d)): every napping child must be checked at least every 15 minutes from when they go down until they wake.
- Medication (7.11(2)): every dose needs written parent consent on file for that medicine (consent must be valid on the date and the dose must match), and the log must have medicine name, dose, time and who gave it.
- Incidents (7.08(8), 7.11(5)(f)): any injury or incident (including a child biting or being bitten) needs an incident report. No incident reports have been written today.
- Attendance (7.04(4)): every child needs a sign-in time and a sign-out time. Children may only go home with a person on their authorized pickup list.
- Late pickup: closing time is 5:30 pm.
- Times: a nap can't end before it starts.
Children:
${roster}
Adults: ${day.staff.map((s: any) => s.name).join(", ")}
Notes (time logged, then text):
${day.notes.map((n: any) => `${n.t} ${n.text}`).join("\n")}

Return JSON: {"problems":[{"rule":"ratio|sleep|med|incident|attendance|late|time","child":"name or null","why":"short reason"}]}. List each problem once per child. If there are none, return {"problems":[]}.`;
  const r = await callGemma(prompt, usage, "baseline");
  const list = Array.isArray(r) ? r : r?.problems ?? [];
  const byName = (n: any) => day.roster.find((c: any) => String(n ?? "").toLowerCase().includes(c.name.toLowerCase()))?.id;
  const found = list.filter((p: any) => SCORED.includes(p.rule)).map((p: any) => ({ rule: p.rule, kids: byName(p.child) ? [byName(p.child)] : [], title: p.why }));
  return { found, usage, wallMs: Date.now() - t0 };
}

const results: any[] = [];
let tot = { planted: 0, caught: 0, missed: 0, fa: 0, ms: 0, inT: 0, outT: 0, notes: 0 };
for (const f of files) {
  const day = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
  const r: any = mode === "baseline" ? await baseline(day) : await pipeline(day);
  const s = score(day, r.found);
  results.push({ day: day.id, notes: day.notes.length, planted: day.planted.length, caught: s.caught.map((p) => `${p.rule}:${p.kid ?? "-"}`), missed: s.missed.map((p) => `${p.rule}:${p.kid ?? "-"} (${p.what})`), falseAlarms: s.falseAlarms.map((x) => `${x.rule}:${x.kids.join(",")} ${x.title}`), wallMs: r.wallMs, inTokens: r.usage.inTokens, outTokens: r.usage.outTokens, calls: r.usage.calls, retries: r.usage.retries, questions: r.questions, unverified: r.unverified, events: r.events });
  tot.planted += day.planted.length; tot.caught += s.caught.length; tot.missed += s.missed.length; tot.fa += s.falseAlarms.length; tot.ms += r.wallMs; tot.inT += r.usage.inTokens; tot.outT += r.usage.outTokens; tot.notes += day.notes.length;
  console.log(`${day.id} caught ${s.caught.length}/${day.planted.length} fa ${s.falseAlarms.length} ${(r.wallMs / 1000).toFixed(1)}s ${s.missed.length ? "MISSED " + s.missed.map((p) => p.rule + ":" + p.kid).join(" ") : ""} ${s.falseAlarms.length ? "FA " + s.falseAlarms.map((x) => x.rule + ":" + x.kids + " " + x.title).join(" | ") : ""}`);
}
const tag = `${mode}${LOCAL ? "-local" : ""}${DIR.includes("holdout") ? "-holdout" : ""}`;
const summary = { mode: tag, model: MODEL, ranAt: new Date().toISOString(), days: files.length, ...tot, avgSecPerDay: +(tot.ms / files.length / 1000).toFixed(1) };
writeFileSync(`evals/results-${tag}${only ? "-" + only : ""}.json`, JSON.stringify({ summary, results }, null, 1));
console.log(summary);
