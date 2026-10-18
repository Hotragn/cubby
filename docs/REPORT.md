# Cubby eval report (all test data is SYNTHETIC)

Every child, adult and note in `evals/` was invented for testing. Problems were planted on purpose, and the answer key was written by the same script before any model saw a note.

## Protocol
- **Dev set** (`evals/days`): 12 generated days, 337 notes, 21 planted problems. I used it to find bugs. Three fixes came out of it:
  - "had a few bites" of food was read as an injury.
  - A "06:59" sign-in was read as pm.
  - The generator leaked unplanned late pickups.
- **Held-out set** (`evals/holdout`): 12 days from the same generator with a new seed, plus 2 hand-written days in messy, spoken style. 383 notes, 37 planted problems. The key was committed (a2bde45) before the run, and each set was run once.
- **Scoring:** a planted problem is "caught" if a flag has the same rule and child. A "false alarm" is any flag that matches no planted item. Questions the model asks (rather than guesses) are not scored.
- **Baseline:** the same Gemma model gets the roster (ages, consents, pickup lists), a plain-English version of the same rules and all of the day's notes, and is asked to list every problem as JSON. Same scorer.

## Results (gemma-4-26b-a4b-it on Google AI Studio, thinking "minimal")

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
