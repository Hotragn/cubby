// Records Gemma's reading of the four earlier fictional demo days (week view).
import { writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { extract, newUsage, MODEL } = await import("../src/gemma.ts");
const { DEMO_WEEK, sampleRoster, SAMPLE_STAFF } = await import("../public/lib/sample.js");
const out: any = { model: MODEL, recorded: new Date().toISOString(), days: {} };
for (const d of DEMO_WEEK) {
  const notes = d.notes.map(([t, text]: any, i: number) => ({ id: `W${d.back}N${i + 1}`, t, text }));
  const usage = newUsage();
  out.days[d.back] = await extract(notes, sampleRoster("2026-10-16"), SAMPLE_STAFF, usage);
  console.log("day -" + d.back, usage.calls, usage.retries);
}
writeFileSync("public/lib/sample-week.json", JSON.stringify(out));
