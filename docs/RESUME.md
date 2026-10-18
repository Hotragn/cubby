# RESUME — Cubby (week2-daycare)

Deadline: DEV Hacktoberfest Week 2 ends 2026-10-19 06:59 UTC (publish target 04:59 UTC). Founder publishes; we only stage the draft.

## Founder decisions (Oct 18 ~21:30 UTC)
- Render: YES, deploy to a NEW service once phone checks pass.
- Repo: stays PRIVATE until all work is over; ask again before making it public.
- First user: no real person. Use public forum posts (Reddit, daycare.com, app reviews) as cited research. Never fake a user.
- Never touch week2/ (Stitch Math), its Render service or its DEV draft.

## Status (updated ~22:35 UTC Oct 18)
- [x] research/RESEARCH.md (prices + MA/WA regs; chose MA 606 CMR 7.00), research/FORUMS.md (App Store reviews, CA inspection reports; Reddit blocked)
- [x] rules engine + 6 tests (npm test), Gemma extraction, fictional sample day (9 planted, all caught), recorded in public/lib/sample-extract.json
- [x] React UI (web/, esbuild → public/build), React Bits components, Whisper in-browser (tested: 1.2 s/note), ElevenLabs /api/speak (tested), Mongo /api/feedback (anon tester feedback only)
- [x] evals: dev set 21/21 caught, 2 false alarms after 3 eval-driven fixes; baseline (Gemma alone) dev 16/21, 67 FA
- [ ] held-out run (evals/holdout, committed a2bde45 before running) → evals/results-*-holdout.json
- [ ] local Ollama timing on a few held-out days
- [ ] Render: BLOCKED — repo is private; Render API says "unfetchable". Needs founder to grant Render's GitHub app access to Hotragn/cubby. Then: python3 scripts/render.py create tea-db1kv5s9v7es7382nlsg (plan starter)
- [ ] docs/REPORT.md, DEV draft (published:false), phone + in-app browser checks on the live URL

## How to run
npm i; npm start  (port 8787). GEMMA_LOCAL=1 for Ollama gemma4:e4b-it-q4_K_M.
