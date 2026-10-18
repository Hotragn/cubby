# DECISIONS

1. Name: **Cubby** — a daycare word parents already know (the shelf with their kid's name on it). Short, warm, not "AI".
2. Stack: Node 26 type-stripped TS server (same zero-build setup that worked in week2), vanilla JS front end. Rule engine is plain ES modules in public/lib so it runs in the browser (child data stays on device) and in Node tests/evals.
3. The model only reads notes into events (with an exact quote from the note). Code checks every rule and builds every report. A quote that isn't really in the note is flagged, not trusted.
4. Speech-to-text: Whisper (open weights) running in the browser through transformers.js, so audio never leaves the phone, in hosted and local mode alike.
5. Data: browser storage only. The server is stateless: it passes notes to Gemma and returns JSON. Hosted demo = fictional sample data only.
