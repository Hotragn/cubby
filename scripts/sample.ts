// Runs the fictional sample day through Gemma once and saves the result, so the demo
// opens instantly with real model output (public/lib/sample-extract.json).
import { writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { extract, newUsage, MODEL } = await import("../src/gemma.ts");
const { SAMPLE_NOTES, sampleRoster, SAMPLE_STAFF } = await import("../public/lib/sample.js");
const notes = SAMPLE_NOTES.map(([t, text]: any, i: number) => ({ id: `N${i + 1}`, t, text }));
const roster = sampleRoster("2026-10-16");
const usage = newUsage(); const t0 = Date.now();
const out = await extract(notes, roster, SAMPLE_STAFF, usage);
const wall = Date.now() - t0;
writeFileSync("public/lib/sample-extract.json", JSON.stringify({ model: MODEL, recorded: new Date().toISOString(), wallMs: wall, usage, notes: out }, null, 1));
console.log(MODEL, wall, "ms", usage);
