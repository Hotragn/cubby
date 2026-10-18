# RESUME — Cubby (week2-daycare)

Deadline: DEV Hacktoberfest Week 2 ends 2026-10-19 06:59 UTC (publish target 04:59 UTC). Founder publishes; we only stage the draft.

## Founder decisions (Oct 18 ~21:30 UTC)
- Render: YES, deploy to a NEW service once phone checks pass.
- Repo: stays PRIVATE until all work is over; ask again before making it public.
- First user: no real person. Use public forum posts (Reddit, daycare.com, app reviews) as cited research. Never fake a user.
- Never touch week2/ (Stitch Math), its Render service or its DEV draft.

## Status
- [ ] research/RESEARCH.md (prices + regs) — subagent
- [ ] research/FORUMS.md (provider pain) — subagent
- [ ] rules engine + tests
- [ ] extraction (Gemma) + sample day
- [ ] UI
- [ ] evals (pipeline vs Gemma-alone, cloud vs local timing/cost)
- [ ] deploy (Render), phone checks
- [ ] DEV draft (published:false) + test kit

## How to run
npm i; npm start  (port 8787). GEMMA_LOCAL=1 for Ollama gemma4:e4b-it-q4_K_M.
