# RESUME — Cubby (week2-daycare)

Deadline: DEV Hacktoberfest Week 2 ends 2026-10-19 06:59 UTC (publish target 04:59 UTC). Founder publishes; we only stage the draft.

## Founder decisions (Oct 18 ~21:30 UTC)
- Render: YES, deploy to a NEW service once phone checks pass.
- Repo: stays PRIVATE until all work is over; ask again before making it public.
- First user: no real person. Use public forum posts (Reddit, daycare.com, app reviews) as cited research. Never fake a user.
- Never touch week2/ (Stitch Math), its Render service or its DEV draft.

## Status (updated ~23:30 UTC Oct 18)
- LIVE: https://cubby-daycare.onrender.com (Render free plan, service srv-dbakemvbtjjs73fh5ceg, autodeploy from Hotragn/cubby master; GitHub Actions keep-awake every 10 min)
- DEV draft (unpublished): id 4874285, edit https://dev.to/hotragn/cubby-a-home-daycare-talks-through-its-day-gemma-writes-the-log-and-code-catches-37-of-37-6a-temp-slug-3747251/edit (AI disclosure some_ai). Source in docs/post.md.
- Evals done: dev 21/21 (2 FA) vs Gemma-alone 16/21 (67 FA); held-out 37/37 (6 FA) vs 30/37 (72 FA); local E4B on 2 hand days 16/16 (4 FA), 108.6 s/day on M4. docs/REPORT.md.
- Verified on live: first load (375x812, 320x568, narrow pane), add note → event + new flag, Spanish sheet + grounding check, ElevenLabs voice, PDF/CSV export (PDF fixed), Mongo feedback (one smoke-test doc labelled as such).
- NOT verified: real WhatsApp / Brave in-app browsers and a real phone mic (can't run them here). Founder should open the link from WhatsApp once.

## Before publishing (founder)
1. Make Hotragn/cubby public (founder said private until work is over). I scan for secrets first.
2. Open the live link from WhatsApp/Brave on a phone.
3. Recheck DEV for new daycare rivals and compare with Stitch Math draft 4872054; publish only one.
