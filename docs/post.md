*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

It's 2:45 pm at a home daycare. Two toddlers just woke up, the baby is fussing, and the assistant heads out for the school run. The provider taps a note into her phone: **"Dana out for school run."**

Four of the children in the house are under two. Massachusetts allows one adult to have up to six children, but [no more than three under age two](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10). For the next 30 minutes the house is out of ratio, and nobody notices. It's in the notes. It just isn't anywhere anyone will look.

Earlier, between 12:50 and 1:25, 35 minutes passed without a check on the sleeping baby. The rule is every 15 minutes. That's in the notes too.

(Rosa, Dana and the kids are invented. The demo day is fictional, and so is every test day below.)

**Cubby** reads those notes. On 14 held-out synthetic days, it caught **37 of 37 planted licensing problems, with 6 false alarms**. The same open model asked to find the problems on its own caught 30 and raised 72 false alarms.

## What I Built

Cubby is a daily-report and licensing-log assistant for **home daycare providers**. Running a licensed daycare out of your own home is a classic side business, and one of the most paperwork-heavy. Child Care Aware of America counted [94,227 licensed family child care homes in 2023](https://www.childcareaware.org/?p=76062) across the 39 states with data, down 12% since 2019.

Every day, a provider owes two kinds of paperwork:

- **Every parent** wants a daily sheet: what they ate, how long they slept, diapers, mood, anything that happened.
- **The licensing inspector** wants accurate logs: sign-in and sign-out times, sleep checks, medication with consent, incident reports, ratios.

Today most providers write these from memory at nap time, or pay for an app. Here's what the apps I checked publish (2026-10-18):

| App | Published price |
|---|---|
| [Daily Connect](https://en.dailyconnect.com/pricing) | $8.99/mo up to 3 kids, $12.99/mo up to 6, or $16/mo billed annually for 10 kids + $1.60 each extra |
| [Famly (US)](https://www.famly.co/us/pricing) | from $49/month |
| [Brightwheel](https://mybrightwheel.com/pricing), [Procare](https://www.procaresoftware.com/pricing/), [Lillio](https://www.lillio.com/features/pricing), [Playground](https://www.tryplayground.com/pricing) | contact sales |

None of those pricing pages mention medication consent or incident-report checks, yet that's exactly what inspectors cite. Public California inspection reports show family child care homes cited for [having no infant sleep log](https://readyrule.com/daycare/483009518-forcella-sherrie-fcch/report/2024-01-04) and [leaving out the time of each 15-minute check](https://readyrule.com/daycare/483010237-james-bethany-fcch/report/2023-10-16). Providers clearly pay for daily reports. Cubby adds the part that keeps their license safe.

**How it works:**

1. **Capture.** Type or hold the mic and talk. "Ava and Leo napped 1:10 to 2:40" is one note about two children. Speech-to-text is Whisper running *in the browser*, so audio never leaves the phone.
2. **Read.** Gemma turns each note into structured events: meals and how much, naps, sleep checks, diapers, incidents, medicine (name, dose, time, who gave it), mood, pickups. Every event carries the **exact words** it came from. If a note is unclear ("the baby had a 4 oz bottle"), Gemma asks *which child?* instead of guessing.
3. **Check.** Plain code, no model, checks every rule in Massachusetts' family child care regulations ([606 CMR 7.00](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10)):
   - napping children checked at least every 15 minutes (7.10(7)(d))
   - ratio minute by minute from sign-in/out times (7.10(4))
   - medication with consent on file, a matching dose, and the log fields (7.11(2)); oral over-the-counter consent renews weekly
   - any injury mentioned without a finished incident report, with a pre-filled draft (7.08(8))
   - every child signed in and out to someone on the pickup list (7.04(4))
   - late pickups, and times that can't be right

   **Every flag shows the note that caused it and the rule it comes from.**
4. **Send.** Each parent gets a short sheet built from the checked events. Gemma can make it warmer or write it in Spanish, Portuguese, Haitian Creole, Arabic and more. Before anyone sees it, code checks every time, number, food and health word against the log. If Gemma added anything, the plain version is used. Injuries and medicine are **never re-worded**: they stay in the provider's exact words. And one parent's sheet never names another child ("Another child bit Leo on the arm…"). (A [public App Store review](https://apps.apple.com/us/app/id428376881) of another daycare app describes a Spanish machine translation that turned a child being "out" sick into a child who had "died".)
5. **Inspector log.** One tap exports the day as PDF or CSV. Each entry keeps the note it came from.

## Demo

**Live:** https://cubby-daycare.onrender.com. It opens on a fictional day with 4 fictional children and 9 planted problems, so the flags are there on first load. It's built for a phone.

![Today at 2:50 pm: over ratio right now](https://cubby-daycare.onrender.com/shots/today.jpg)

![To fix: the ratio problem, with the two notes that prove it and the rule](https://cubby-daycare.onrender.com/shots/fix.jpg)

![Ava's sheet in Spanish, checked against the log; the incident line stays exactly as logged](https://cubby-daycare.onrender.com/shots/sheet.jpg)

Try typing a note in the bottom bar (made-up names only, please), for example "Theo scraped his elbow on the fence at 4:30, bandaid, Rosa". Within a few seconds it shows up as an incident, and the To fix list grows by one, with a pre-filled report.

## Code

{% github Hotragn/cubby %}

## How I Built It

**The split is the whole design: the model reads, code judges.** I didn't want an LLM deciding whether a baby's nap was safely supervised. So Gemma's only job is turning "checked all 1:40" into `{"type":"sleep_check","kids":["all"],"time":"1:40"}`. It isn't trusted even with that:

- Names must be on the roster.
- Times must parse (providers write "1:10" meaning pm, and Whisper writes it as "110").
- The quoted words must really appear in the note, or the event is marked unverified.
- "All" only counts if the note actually says all.

Then about 230 lines of rule code run in the browser, so the day's data stays on the device.

A backstop catches what the model misses. Code also scans the raw notes for injury and medicine words. If a provider writes "goose egg on his forehead" and Gemma doesn't log an incident, the flag still fires and says that code caught it.

**Testing it honestly.** I wrote a generator for synthetic days with problems planted in every rule type, plus two hand-written days in a messy, spoken style ("um Clara had her Motrin three ml at like 10:15 I gave it"). The first 12 days were a dev set. Running it found three real bugs in my own code:

- "had a few bites" of toast counted as an injury.
- A 06:59 sign-in was read as 6:59 pm, so the whole day looked like it had no adult.
- My generator put late pickups in the data that weren't in the answer key.

After fixing those, I committed a **held-out set** of 14 days, answer key included, and ran it once:

| Held-out (37 planted) | Caught | False alarms |
|---|---|---|
| **Cubby** (Gemma reads, code checks) | **37** | **6** |
| **Gemma alone** (same model, same rules in plain English, same notes) | 30 | 72 |

Gemma alone missed 3 of the 4 ratio problems; it doesn't count heads minute by minute. It also missed every 20-minute sleep-check gap on the hand-written day. Most of its false alarms were confused complaints about times. **Where Gemma alone wins:** it uses about a quarter of the tokens, and it caught every incident too. Cubby's 6 false alarms are real weaknesses. "Grapes cut in quarters" tripped my injury-word backstop (fixed after the run, not re-scored). A pretend doctor kit raised a "check" item. "Bodhi's mom here" wasn't read as a sign-out. The full report is in `docs/REPORT.md`.

**Speed and cost per day of notes** (about 27 notes):

- **Cloud** (Gemma 4 26B A4B on Google AI Studio): 34 s, about 6.7k tokens. Gemma 4 is listed as [free of charge on the free tier](https://ai.google.dev/gemini-api/docs/pricing), so the model costs $0, with rate limits. On a paid host, [OpenRouter lists it](https://openrouter.ai/google/gemma-4-26b-a4b-it) at $0.0675 per million input tokens and $0.225 per million output, so a day of notes costs about $0.001, or roughly 2 cents a month.
- **Local** (Gemma 4 E4B through Ollama on an M4 Mac): about 109 s per day, $0 beyond electricity. On the two hand-written days it caught all 16 planted problems, with one more false alarm than the cloud model.

**Stack:** a zero-build Node 26 TypeScript server, React with a small esbuild bundle, [React Bits](https://github.com/DavidHDev/react-bits) for the voice pill, counters and check animations, jsPDF for the export, and transformers.js for Whisper.

## Why Does Open Innovation Matter?

Because the data is **children's**. Nap times, diapers, injuries and medicine are about the most private records a small business keeps.

With an open-weight model, the whole pipeline runs on the provider's own laptop. Gemma 4 E4B goes through Ollama, Whisper runs in the browser, and the rule engine runs in the page. No note, voice or photo goes to anyone. The hosted demo uses Google AI Studio *only* because every child in it is made up.

It also keeps the business viable. Home providers complain in public reviews about per-child pricing they only found after a trial. Daily Connect's 6-kid plan is $12.99/month. With an open model, a day of reading costs a tenth of a cent hosted, or nothing locally. So I'd charge a **flat $9 a month for up to 12 children**, and the open-source version stays free to self-host.

Finally, openness is what lets you check the work. Every rule cites its regulation, every flag shows its evidence, and the code that decides is readable. A provider doesn't have to trust me. They can read the line that flagged them.

## Prize Categories

- **Best Use of Gemma:** Gemma 4 does all of the reading: notes into events, questions instead of guesses, and warm or translated parent sheets. Cloud runs 26B A4B, local runs E4B. Both were measured against Gemma-alone on the same held-out days.
- **Best Use of Render:** the demo runs as a Render web service built from the repo on every push.
- **Best Use of ElevenLabs:** "Listen" reads the checked parent sheet aloud, for parents who'd rather hear the day than read it.
- **Best Use of Sentry Agent Tracing:** every Gemma call is a `gen_ai.chat` span with the model, task and token counts. The spans never include note text or names.
- **Best Use of MongoDB Atlas:** it stores one thing, anonymous tester feedback from `/feedback.html`. No child data, by design.

**Honest limits:**
- I wrote both the rules and the tests. The held-out days share the generator's templates, apart from the two hand-written ones.
- Only Massachusetts is encoded, and one ratio clause (7–8 children with school-agers) isn't.
- Whisper tiny mishears names ("Leo" became "Theo"), so the note stays editable before it's sent.
- This isn't legal advice.
- I don't have a first user yet. A 2-minute test kit is in `docs/TEST-KIT.md`, and I won't claim a user until one has actually tried it.

*How I used AI: I picked this idea and directed the build. Claude Code wrote the code, generated the synthetic test days, ran the evaluations and drafted this post from the repo's results. Every child, adult and note in the demo and the tests is invented.*
