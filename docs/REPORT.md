# Cubby eval report (all test data is SYNTHETIC)

## Final numbers (Oct 18, current code; all scored by the same rule code)

| Reader | Dev set (21 planted, 12 days) | Held-out (37 planted, 14 days) | Held-out, 2 hand-written days only (16 planted) | Seconds per day of notes |
|---|---|---|---|---|
| **Gemma 4 26B A4B, cloud** (AI Studio) + code | 21 caught, 2 false alarms | **37 caught, 4 false alarms** | 16 caught, 1 false alarm | 34–39 (3 batches in parallel) |
| Gemma 4 26B A4B **alone** (asked to find the problems) | 16 caught, 67 false alarms | 30 caught, 72 false alarms | 12 caught, 6 false alarms | 12–32 (one call) |
| **Gemma 4 E4B, local** (Ollama, M4 Mac 24 GB) + code | not run | 37 caught, 18 false alarms | 16 caught, 2 false alarms | 161 average (Ollama shared with app tests during the run; 109 when run alone on the 2 hand days) |
| **Qwen3.5-4B + LoRA trained on Tinker** + code | 21 caught, 9 false alarms | 37 caught, 10 false alarms | 16 caught, 1 false alarm | 3.5 (one Tinker sampling call per note, in parallel) |

**Reading the table:**
- Every reader paired with Cubby's code caught every planted problem. They differ in false alarms and speed.
- The cloud model makes the fewest false alarms.
- The local E4B model makes the most: it misses wake-up times and sign-outs, and code then flags those as missing.
- The Tinker student is about 10 times faster than the cloud model.
  - 8 of its 10 held-out false alarms come from one day, where it logged a pretend doctor kit's "medicine" as real doses.
  - On the hand-written days, the only ones outside the generator's templates, it ties the cloud model.
  - It was trained on Gemma 26B's own labels, so matching Gemma is the most it could be expected to do.
  - **It doesn't beat Gemma**, so Cubby keeps Gemma as the default reader.

**Local mode in the running app:** with `GEMMA_LOCAL=1`, the server read the whole fictional demo day (39 notes) in 162 s with no cache. All 9 planted problems were flagged (`evals/local-sample-day.json`).

**Tinker training:**
- 1,291 notes from 48 SYNTHETIC training days (generator seeds 9101–9404, never the held-out seed 4242).
- Labels came from Gemma 4 26B A4B, keeping only notes whose events passed Cubby's checks; 57 notes were dropped.
- Qwen/Qwen3.5-4B with a rank-32 LoRA: 2 epochs, 82 steps, 233 s of training, loss 0.205 → 0.031 (`ml/out/run.json`). The first plan was to label with Gemma 31B; it took 37 s to answer "Say ok" that night, so I used 26B.


Every child, adult and note in `evals/` was invented for testing. Problems were planted on purpose, and the answer key was written by the same script before any model saw a note.

## Protocol
- **Dev set** (`evals/days`): 12 generated days, 337 notes, 21 planted problems. I used it to find bugs. Three fixes came out of it:
  - "had a few bites" of food was read as an injury.
  - A "06:59" sign-in was read as pm.
  - The generator leaked unplanned late pickups.
- **Held-out set** (`evals/holdout`): 12 days from the same generator with a new seed, plus 2 hand-written days in messy, spoken style. 383 notes, 37 planted problems. The key was committed (a2bde45) before the run, and each set was run once.
- **Scoring:** a planted problem is "caught" if a flag has the same rule and child. A "false alarm" is any flag that matches no planted item. Questions the model asks (rather than guesses) are not scored.
- **Baseline:** the same Gemma model gets the roster (ages, consents, pickup lists), a plain-English version of the same rules and all of the day's notes, and is asked to list every problem as JSON. Same scorer.

## Run history on the held-out set (each run re-reads every note)
| Run | Code | Caught | False alarms |
|---|---|---|---|
| 1 (Oct 18, first and only run before any held-out-driven change) | a2bde45 | 37/37 | 6 |
| 2 (after the "cut" fix; evals/log-holdout-pipeline-run2.txt) | before setup work | 37/37 | 4 |
| 3 (after setup/aliases/question changes; raw outputs saved in evals/raw/) | current | 37/37 | 4 |

Run 3's 4 false alarms:
- "pretend doctor kit … 'medicine'" (day-01)
- "who picked up at 4:43?" (day-06)
- diaper cream logged without a dose (day-12; the key didn't count it as a problem)
- "Bodhi's mom here" not read as a sign-out (hand-A)

A re-score bug is worth recording: the dev and held-out sets share file names, so for one re-score the cached held-out outputs had been overwritten by dev outputs, and it scored 28/37. The cache is now keyed by set, and run 3 re-read everything.

## Results (gemma-4-26b-a4b-it on Google AI Studio, thinking "minimal"): run 1 detail

| Set | Cubby (Gemma reads, code checks) | Gemma alone |
|---|---|---|
| Dev, 21 planted | **21 caught**, 2 false alarms | 16 caught, 67 false alarms |
| Held-out, 37 planted | **37 caught**, 6 false alarms | 30 caught, 72 false alarms |

Held-out, by rule (Cubby / Gemma alone): sleep checks 9/9 vs 6/9 · ratio 4/4 vs 1/4 · medication 6/6 vs 5/6 · incidents 8/8 vs 8/8 · attendance 6/6 vs 6/6 · late 3/3 vs 3/3 · times 1/1 vs 1/1.

**Where Gemma alone missed:**
- 3 of 4 ratio problems. It doesn't count who is present minute by minute.
- All three 20-minute sleep-check gaps on hand-written day B.
- A medicine entry with no dose.

**Where Gemma alone made false alarms:** 46 "time" complaints (it mixed up the 24-hour log stamps with "2:30" in the note text) and 24 attendance complaints.

**Where Gemma alone wins:**
- Token use: about 970 input and 430 output tokens per day, versus Cubby's ~3,550 and ~3,190. Cubby asks for every event and an exact quote for each.
- It also caught every incident.

**Cubby's 6 held-out false alarms, all real weaknesses:**
- "grapes cut in quarters" triggered the injury-word backstop for 2 children. Fixed afterwards (`cut` now needs "a cut" or "cut his/her…"), not re-scored.
- "pretend doctor kit, gave everyone 'medicine'" raised a "check" item.
- Diaper cream applied at a change wasn't logged as medicine by Gemma, so code raised a "check" item.
- "Bodhi's mom here" was not read as a sign-out.
- A pickup line with no person named ("who picked up at 4:43?").

## Speed and cost per day of notes
- Cloud, Gemma 4 26B A4B on AI Studio: 33.9 s average per day (about 27 notes, 3 batches in parallel), ~6.7k tokens per day. Google's pricing page lists Gemma 4 as "Free of charge" on the free tier, with no paid tier (checked 2026-10-18, https://ai.google.dev/gemini-api/docs/pricing). So the model cost is $0 at the cost of rate limits. On a paid host, OpenRouter lists gemma-4-26b-a4b-it at $0.0675/M input and $0.225/M output (API, checked 2026-10-18), which works out to about $0.00096 per day of notes. One baseline call took 282 s while waiting on retries.
- Local, Gemma 4 E4B (q4_K_M) through Ollama on an Apple M4 Mac with 24 GB: 108.6 s average per day on the 2 hand-written held-out days (46 notes). It caught 16/16, with 4 false alarms; the cloud model had 3 on the same days. The extra one: "Greta picked up by mom" wasn't read as a sign-out. Marginal cost is electricity.
- Speech: Whisper tiny.en in the browser transcribed a 5-second note in 1.2 s after a one-time ~40 MB model download. It misheard "Leo" as "Theo", so the text stays editable before it's sent.

## Limits
- I wrote both the rules and the test days. The generated held-out days share templates with the dev set; only the 2 hand-written days are truly new phrasing.
- Not modeled: Massachusetts 7.10(4)(e) (7–8 children with school-agers) and the "one of them walking" detail of 7.10(4)(d).
- Regulation text comes from the Cornell LII mirror of 606 CMR 7.00. This is not legal advice.

## Durable timers (Temporal, local dev server)
`node scripts/temporal-restart-test.ts`: a 20 s sleep-check timer, worker killed at 5.0 s and restarted at 12.0 s. The reminder fired at 20.1 s (108 ms late). Raw result: `evals/temporal-restart.json`. End to end in the app (local mode, TIMER_SCALE=60): a live note "Theo down for nap now" was read by Gemma 4 E4B on this Mac, and "Sleep check due for Theo" appeared in the app when the scaled 15-minute timer ran out.

## Phone checks done from the laptop
375×812 (Android Chrome user agent), 320×568 and a narrow pane: no horizontal scroll, and the note bar is 60 px tall. `?micdenied=1` and `?novoice=1` exercise the fallbacks; typed notes work in both. Real WhatsApp and Brave in-app browsers, iOS Safari and a real mic are left to docs/PHONE-TEST.md.
