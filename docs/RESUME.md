# RESUME — Cubby (week2-daycare)

Deadline: DEV Hacktoberfest Week 2 ends 2026-10-19 06:59 UTC (publish target 04:59 UTC). Founder publishes; we only stage the draft.

## Founder decisions (Oct 18 ~21:30 UTC)
- Render: YES, deploy to a NEW service once phone checks pass.
- Repo: stays PRIVATE until all work is over; ask again before making it public.
- First user: no real person. Use public forum posts (Reddit, daycare.com, app reviews) as cited research. Never fake a user.
- Never touch week2/ (Stitch Math), its Render service or its DEV draft.

## Status (Oct 18, ~23:50 UTC): all 8 requested items done except the founder's phone test
- LIVE: https://cubby-daycare.onrender.com (Render free plan, srv-dbakemvbtjjs73fh5ceg). DEV draft 4874285 (unpublished, some_ai).
- Built: setup (My program: children, staff, rules, import/export), week view + weekly PDF/CSV, answers + aliases, phone fallbacks, Temporal timers (local), Tinker LoRA reader (experiment), local mode in the app.
- Final numbers: docs/REPORT.md, top table. Cloud 37/37 4 FA · Gemma alone 30/37 72 FA · local E4B 37/37 18 FA · Tinker Qwen3.5-4B 37/37 10 FA (3.5 s/day). 11 tests pass. Secret scan clean.
- WAITING ON FOUNDER: run docs/PHONE-TEST.md (WhatsApp, Brave, real voice), say when to make Hotragn/cubby public (right before publishing), find a first tester (docs/TEST-KIT.md).

## To reproduce locally
temporal server start-dev · CUBBY_URL=http://localhost:8788 node src/temporal/worker.ts · PORT=8788 GEMMA_LOCAL=1 TEMPORAL_ADDRESS=localhost:7233 TIMER_SCALE=60 node src/server.ts
Tinker: .venv (python 3.13) · .venv/bin/python ml/train_tinker.py · score: EXTRACTOR=tinker RESCORE=1 RAW_TAG=tinker-qwen3.5-4b DAYS=evals/holdout node evals/run.ts pipeline

## Oct 19 ~04:35 UTC: first-time experience rebuilt
Plain-English intro, a 3-step tour (auto on first visit, replay with ?), How it works sheet, tab subtitles, labelled replay slider, the tile matches the Fix count, no heading animation, light theme by default (dark toggle), AA contrast fixes. Live and verified at 375/320 in a fresh browser; the post's Demo section is updated.

## Before publishing (founder)
1. Phone test results back (fix anything found).
2. Make Hotragn/cubby public (I re-scan first).
3. Recheck DEV for rivals; compare with the Stitch Math draft 4872054; publish only one.
