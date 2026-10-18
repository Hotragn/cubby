# Cubby

**Daily parent sheets and licensing logs for home daycare, from quick notes.**

A home daycare provider talks or types quick notes all day ("Ava and Leo napped 1:10 to 2:40"). Gemma, an open model, turns each note into structured events per child. Plain code then builds every parent's daily sheet and checks every licensing rule. Each flag shows the note that caused it and the regulation it comes from. The provider reviews, fixes and sends.

**The model never makes a safety judgment.** Code decides whether a nap went unchecked for too long, whether medicine had consent, and whether the ratio was over. The model only reads.

The demo opens on a fictional week for 4 fictional children, with 9 planted problems on the latest day. **My program** is the real thing: add your own children (date of birth or age group, allergies, medication consents, photo consent, pickup list), staff and rules. Everything is saved on the device, and you can export or import it as a file.

## What it checks (Massachusetts, 606 CMR 7.00)

| Check | Rule | Source |
|---|---|---|
| Sleep checks: every napping child at least every 15 min | 7.10(7)(d) | [LII mirror](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10) |
| Ratio, minute by minute from sign-in/out times: 1 educator ≤ 6 children with ≤ 3 under age 2; 2 educators ≤ 10 with ≤ 6 under 2 and ≤ 3 infants | 7.10(4)(d)–(h) | same |
| Medication: consent on file and still valid (oral OTC consent renews weekly), dose matches, log has name, dose, time and who gave it | 7.11(2)(j),(l) | [7.11](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-11) |
| Any injury word in any note without a finished incident report, with a pre-filled draft | 7.08(8), 7.11(5)(f) | [7.08](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-08) |
| Attendance: sign-in and sign-out for every child, and who picked up (checked against the pickup list) | 7.04(4) | [7.04](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-04) |
| Times that can't be right (a nap that ends before it starts, overlaps, events after sign-out); late pickups | records / provider policy | |

Rule packs live in `public/lib/states.js`. Adding a state means adding a pack with its numbers and citations.

## Features

- **Setup:** children, staff and program rules (state pack, sleep-check interval, ratio limits). Settings looser than the state's rule show a warning with the citation.
- **Today:** who's here at any time of day, who's napping and when their next sleep check is due, an over-ratio banner, and every note with the events read from it.
- **Fix:** every flag with its evidence and rule. Pre-filled incident reports. Questions Gemma asked instead of guessing. Answering "which child is 'the baby'?" attaches the event, re-runs every rule and remembers "the baby" for the rest of the day.
- **Parents:** a sheet per child, a photo slot (only with photo consent), warm or translated text checked against the log, and read-aloud.
- **Week:** attendance, flags opened and resolved, incidents and medicine per day, plus a weekly inspector log (PDF/CSV) in the daily format.
- **Timers (local, optional):** sleep-check and late-pickup reminders as Temporal workflows that survive restarts.

## How it works

```
note ──Gemma 4──▶ events (+ exact quote from the note) ──normalize.js──▶ checked events ──rules.js──▶ flags with evidence
                                                                          └──sheet.js──▶ parent sheet (Gemma may re-word it; the result is checked again)
```

- `src/gemma.ts`: the extraction prompt. Gemma copies what the note says and leaves unclear fields null. If it can't tell which child, it asks a question.
- `public/lib/normalize.js`: names must be on the roster and times must parse. The quote must really be in the note; if not, the event is marked unverified.
- `public/lib/rules.js`: every check, as plain code. It also scans the raw notes for injury and medicine words, so a bump the model missed still gets flagged.
- `public/lib/sheet.js`: builds the sheet from events. If Gemma writes a warmer version or translates it, every time, number, food and health word is checked against the log. If anything was added, the plain sheet is used instead. Injury and medicine lines are never re-worded.
- Voice: Whisper (open weights, `whisper-tiny.en`) runs in the browser through transformers.js, so audio never leaves the phone.

## Run it

```bash
npm ci && npm run build && npm start      # http://localhost:8787
npm test                                   # rule tests on the demo day
```

`.env` needs `GEMINI_API_KEY` (Google AI Studio, model `gemma-4-26b-a4b-it`). `ELEVENLABS` (read-aloud) and `SENTRY_DSN` are optional.

### Durable reminders with Temporal (local)

```bash
temporal server start-dev                      # local dev server, no account
CUBBY_URL=http://localhost:8787 node src/temporal/worker.ts
TEMPORAL_ADDRESS=localhost:7233 npm start      # TIMER_SCALE=60 makes a minute a second, for demos
```

Each live note that starts a nap starts a `napWatch` workflow, which waits for the next sleep check and reminds when it's overdue. Each arrival starts a `pickupWatch` workflow that fires at closing time. `node scripts/temporal-restart-test.ts` kills the worker in the middle of a timer and measures when the reminder fires (`evals/temporal-restart.json`). The hosted demo doesn't run Temporal.

### Local mode (nothing leaves the machine)

```bash
ollama pull gemma4:e4b-it-q4_K_M
GEMMA_LOCAL=1 npm start   # uses gemma4:e4b-it-q4_K_M
```

Same prompt, same checks. Day data is kept only in the browser's storage. The server stores nothing about children.

## Evaluation

The test days in `evals/` are synthetic: every child, adult and note was invented for testing, and the problems were planted on purpose. See `docs/REPORT.md` for results, including where Gemma alone does better or worse.

```bash
node evals/run.ts pipeline                      # Gemma reads, code checks
node evals/run.ts baseline                      # Gemma alone, asked to find the problems
DAYS=evals/holdout node evals/run.ts pipeline   # held-out set
GEMMA_LOCAL=1 DAYS=evals/holdout node evals/run.ts pipeline   # same, on Ollama
RESCORE=1 ...                                   # re-score saved model output (evals/raw/) after a rule change
```

## Fine-tuned small reader (Tinker, experimental)

`ml/train_tinker.py` trains a LoRA on Qwen3.5-4B to read notes into events, using labels from Gemma 4 26B on synthetic training days kept separate from the held-out set. It catches the same planted problems as Gemma on the held-out set and is about 10 times faster, but raises more false alarms (10 vs 4), so Gemma stays the default reader. See docs/REPORT.md.

## Privacy

- The hosted demo uses fictional data only. Don't enter real children's information there.
- For real use, run local mode.
- Photos added to a sheet stay on the phone.
- Sentry gets errors and timings only: no note text, no names.

UI pieces adapted from [React Bits](https://github.com/DavidHDev/react-bits) (MIT + Commons Clause): VoicePill, CountUp, StatusMark, SpringCheck, ClickSpark.
