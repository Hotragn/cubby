// Teacher labels for the Tinker student: Gemma 4 (26B A4B by default) reads the SYNTHETIC training days
// (evals/train, seeds never used for the held-out set). A note is kept only if every event
// passes Cubby's own checks (roster names, quote really in the note).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.GEMMA_MODEL = process.env.TEACHER ?? "gemma-4-26b-a4b-it";
const { extract, newUsage } = await import("../src/gemma.ts");
const { normalizeNote } = await import("../public/lib/normalize.js");
const files = readdirSync("evals/train").flatMap((d) => readdirSync(`evals/train/${d}`).map((f) => `evals/train/${d}/${f}`)).sort();
const out: string[] = []; let kept = 0, dropped = 0;
const usage = newUsage();
for (let i = 0; i < files.length; i += 6) {
  await Promise.all(files.slice(i, i + 6).map(async (f) => {
    const day = JSON.parse(readFileSync(f, "utf8"));
    const raw = await extract(day.notes, day.roster, day.staff, usage);
    for (const n of day.notes) {
      const r = raw[n.id]; if (!r || r.failed) { dropped++; continue; }
      const norm = normalizeNote(n, r, day.roster, day.staff);
      const ok = norm.events.every((e: any) => e.verified) && !norm.questions.some((q: any) => /Who is|couldn't/.test(q.ask));
      if (!ok) { dropped++; continue; }
      kept++;
      out.push(JSON.stringify({ day: f, roster: day.roster.map((c: any) => c.name), staff: day.staff.map((s: any) => s.name), note: n, target: { events: r.events ?? [], questions: r.questions ?? [] } }));
    }
  }));
  console.log(`${Math.min(i + 6, files.length)}/${files.length} days, kept ${kept}, dropped ${dropped}`);
}
writeFileSync("evals/train/labels.jsonl", out.join("\n") + "\n");
console.log("teacher usage", usage);
