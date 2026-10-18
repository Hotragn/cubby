# DECISIONS

1. Name: **Cubby** — a daycare word parents already know (the shelf with their kid's name on it). Short, warm, not "AI".
2. Stack: Node 26 type-stripped TS server (same zero-build setup that worked in week2), vanilla JS front end. Rule engine is plain ES modules in public/lib so it runs in the browser (child data stays on device) and in Node tests/evals.
3. The model only reads notes into events (with an exact quote from the note). Code checks every rule and builds every report. A quote that isn't really in the note is flagged, not trusted.
4. Speech-to-text: Whisper (open weights) running in the browser through transformers.js, so audio never leaves the phone, in hosted and local mode alike.
5. Data: browser storage only. The server is stateless: it passes notes to Gemma and returns JSON. Hosted demo = fictional sample data only.
6. State: Massachusetts 606 CMR 7.00. WA WAC 110-300 was as specific, but MA is the founder's state and every rule we check has a number (15-min sleep checks for all nappers, 1 educator ≤6 with ≤3 under 2).
7. Gemma never words injuries or medicine on parent sheets; those lines are the provider's exact note, with other children's names replaced by "another child".
8. Eval protocol: dev set to find bugs, then a held-out set committed (a2bde45) before one run. Post-run fix ("cut") disclosed, not re-scored.
9. Render free plan (Starter needed a card on file); keep-awake via GitHub Actions. Sentry DSN is shared with week2's project; events tagged app=cubby.
10. MongoDB stores only anonymous tester feedback, database "cubby". No child data on any server.
11. React Bits: VoicePill, CountUp, StatusMark, SpringCheck, ClickSpark. BlurText was dropped because it stayed blank until a re-render; the headline uses a CSS blur-in instead.
12. Tinker and Temporal: not used (not enough time to do them honestly). Nap-check reminders are "next check by" chips in the app instead.
