*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

It's 2:45 pm at a home daycare. Two toddlers just woke up, the baby is fussing, and the assistant heads out for the school run. The provider taps a note into her phone: **"Dana out for school run."**

Four of the children in the house are under two. Massachusetts allows one adult to have up to six children, but [no more than three under age two](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10). For the next 30 minutes the house is out of ratio, and nobody notices. It's in the notes. It just isn't anywhere anyone will look.

Earlier, 35 minutes passed without a check on the sleeping baby. The rule is every 15. That's in the notes too.

(Rosa, Dana and the kids are invented. The demo day is fictional, and so is every test day below.)

**Cubby** reads those notes. On 14 held-out synthetic days, it caught **37 of 37 planted licensing problems, with 4 false alarms**. The same open model asked to find the problems on its own caught 30 and raised 72 false alarms.

## What I Built

Cubby is a daily-report and licensing-log assistant for **home daycare providers**. Running a licensed daycare out of your own home is a classic side business, and one of the most paperwork-heavy. Child Care Aware of America counted [94,227 licensed family child care homes in 2023](https://www.childcareaware.org/?p=76062) across the 39 states with data, down 12% since 2019.

Every day a provider owes each parent a daily sheet (food, sleep, diapers, mood) and owes the licensing inspector accurate logs (sign-ins, sleep checks, medication, incidents, ratios). Most write them from memory at nap time, or pay for an app. Here's what the apps I checked publish (2026-10-18):

| App | Published price |
|---|---|
| [Daily Connect](https://en.dailyconnect.com/pricing) | $8.99/mo up to 3 kids, $12.99/mo up to 6, or $16/mo billed annually for 10 kids + $1.60 each extra |
| [Famly (US)](https://www.famly.co/us/pricing) | from $49/month |
| [Brightwheel](https://mybrightwheel.com/pricing), [Procare](https://www.procaresoftware.com/pricing/), [Lillio](https://www.lillio.com/features/pricing), [Playground](https://www.tryplayground.com/pricing) | contact sales |

None of those pricing pages mention medication consent or incident-report checks, yet that's exactly what inspectors cite. Public California inspection reports show family child care homes cited for [having no infant sleep log](https://readyrule.com/daycare/483009518-forcella-sherrie-fcch/report/2024-01-04) and [leaving out the time of each 15-minute check](https://readyrule.com/daycare/483010237-james-bethany-fcch/report/2023-10-16). Providers clearly pay for daily reports. Cubby adds the part that keeps their license safe.

**How it works:**

1. **Capture.** Type or hold the mic and talk. "Ava and Leo napped 1:10 to 2:40" is one note about two children. Speech-to-text is Whisper running *in the browser*, so audio never leaves the phone.
2. **Read.** Gemma turns each note into events (meals, naps, sleep checks, diapers, incidents, medicine, pickups), each carrying the **exact words** it came from. If a note is unclear ("the baby had a 4 oz bottle"), Gemma asks *which child?* instead of guessing.
3. **Check.** Plain code, no model, checks every rule in Massachusetts' family child care regulations ([606 CMR 7.00](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10)):
   - napping children checked at least every 15 minutes (7.10(7)(d))
   - ratio minute by minute from sign-in/out times (7.10(4))
   - medication with consent on file, a matching dose, and the log fields (7.11(2)); oral over-the-counter consent renews weekly
   - any injury mentioned without a finished incident report, with a pre-filled draft (7.08(8))
   - every child signed in and out to someone on the pickup list (7.04(4))
   - late pickups, and times that can't be right

   **Every flag shows the note that caused it and the rule it comes from.**
4. **Send.** Each parent gets a short sheet built from the checked events. Gemma can warm it up or translate it, and code checks every time, number, food and health word against the log first; if Gemma added anything, the plain version is used. Injuries and medicine are **never re-worded**, and one parent's sheet never names another child ("Another child bit Leo on the arm…"). (A [public App Store review](https://apps.apple.com/us/app/id428376881) of another daycare app describes a Spanish machine translation that turned a child being "out" sick into a child who had "died".)
5. **Inspector log.** One tap exports the day, or the whole week, as PDF or CSV. Each entry keeps the note it came from.

**For a real program, not just the demo:**
- **My program:** each child's date of birth, allergies (checked against every logged food), medication consents with expiry dates, photo consent and pickup list, plus staff and the program's rules. The rules start at the state's numbers and warn if set looser. Everything stays on the device, with export and import as a file.
- **Questions get answered once:** tap Mila for "Which child is 'the baby'?", and the bottle moves to her sheet, every rule re-runs, and the next "the baby napped 3:30 to 4" lands on Mila without asking again.
- **Week view:** attendance, flags opened and resolved, incidents and medicine for each day.

## Demo

**Live:** https://cubby-daycare.onrender.com, a one-page explainer, built for a phone. **Try the demo day** there opens the app (https://cubby-daycare.onrender.com/app) with the tour.

**Start here: tap the tour.** It opens by itself on your first visit; the **?** button replays it. Three steps on the real screens:
1. a made-up day at Rosa's home daycare
2. sending a note and watching it become a log line
3. the 8 things an inspector would flag, then Ava's finished report

Tap **My program** to set up your own.

![First screen: what Cubby is, in one line, with the demo day and the tour button](https://cubby-daycare.onrender.com/shots/home.jpg)

![Tour step 2: a note you send becomes a log line](https://cubby-daycare.onrender.com/shots/tour-note.jpg)

![Tour step 3: the ratio problem, with the two notes that prove it and the rule](https://cubby-daycare.onrender.com/shots/tour-fix.jpg)

![Ava's report in Spanish, checked against the log; the incident line stays exactly as logged](https://cubby-daycare.onrender.com/shots/sheet.jpg)

![The week: flags, incidents and medicine per day, with a weekly inspector export](https://cubby-daycare.onrender.com/shots/week.jpg)

![Local mode: Gemma 4 E4B read "Theo down for nap now" on the laptop, and a Temporal timer raised the sleep-check reminder (demo speed)](https://cubby-daycare.onrender.com/shots/timers.jpg)

## Code

[github.com/Hotragn/cubby](https://github.com/Hotragn/cubby): the rule engine (`public/lib/rules.js`), the Massachusetts rule pack with citations (`public/lib/states.js`), the Gemma prompt (`src/gemma.ts`), the Temporal workflows (`src/temporal/`), and the evaluation (`evals/`, `docs/REPORT.md`).

## How I Built It

**The split is the whole design: the model reads, code judges.** I didn't want an LLM deciding whether a baby's nap was safely supervised. So Gemma's only job is turning "checked all 1:40" into `{"type":"sleep_check","kids":["all"],"time":"1:40"}`. Even that isn't trusted:
- names must be on the roster
- times must parse ("1:10" means pm, and Whisper writes it as "110")
- the quote must really be in the note

Then about 250 lines of rule code run in the browser, so the day's data stays on the device.

A backstop catches what the model misses: code also scans the raw notes for injury and medicine words, so "goose egg on his forehead" raises a flag even if Gemma logs no incident.

**Testing it honestly.** I wrote a generator for synthetic days with problems planted in every rule type, plus two hand-written days in a messy, spoken style ("um Clara had her Motrin three ml at like 10:15 I gave it"). The first 12 days were a dev set, and they found real bugs in my code: "had a few bites" of toast counted as an injury, and a 06:59 sign-in was read as 6:59 pm.

After fixing those, I committed a **held-out set** of 14 days, answer key included, before running it. The first run caught 37 of 37 with 6 false alarms. The table shows the latest run, after the fixes described below:

| Held-out (37 planted) | Caught | False alarms |
|---|---|---|
| **Cubby** (Gemma reads, code checks) | **37** | **4** |
| **Gemma alone** (same model, same rules in plain English, same notes) | 30 | 72 |

Gemma alone missed 3 of 4 ratio problems (it doesn't count heads minute by minute) and every 20-minute sleep-check gap on a hand-written day. **Where Gemma alone wins:** it uses about a quarter of the tokens, and it caught every incident too.

Two of Cubby's first-run false alarms were "grapes cut in quarters" tripping my injury-word backstop, which I fixed after seeing it. The other 4 are real weaknesses:
- a pretend doctor kit
- "Bodhi's mom here" not read as a sign-out
- diaper cream logged without a dose
- a pickup note that named no one

The full report is in `docs/REPORT.md`.

**Speed and cost per day of notes** (about 27 notes):

- **Cloud** (Gemma 4 26B A4B): 34–39 s and about 6.7k tokens. That's [free on AI Studio's free tier](https://ai.google.dev/gemini-api/docs/pricing), or about $0.001 at [OpenRouter's price](https://openrouter.ai/google/gemma-4-26b-a4b-it).
- **Local** (Gemma 4 E4B on Ollama, M4 Mac, in the real app): the demo day's 39 notes took 162 s, with all 9 planted problems flagged. On the held-out set it caught 37 of 37 with 18 false alarms: the small model misses more wake-ups and sign-outs, and code then flags them as missing.
- **Fine-tuned 4B reader** (Qwen3.5-4B + LoRA trained on [Tinker](https://thinkingmachines.ai/tinker/) from Gemma's labels on 1,291 separate synthetic notes): 37 of 37 with 10 false alarms, at 3.5 s per day.

**Stack:** Node 26, React with [React Bits](https://github.com/DavidHDev/react-bits) components, jsPDF, and transformers.js for Whisper.

## Why Does Open Innovation Matter?

Because the data is **children's**. Nap times, diapers, injuries and medicine are about the most private records a small business keeps.

With an open-weight model, the whole pipeline runs on the provider's own laptop. Gemma 4 E4B goes through Ollama, Whisper runs in the browser, and the rule engine runs in the page. No note, voice or photo goes to anyone. The hosted demo uses Google AI Studio *only* because every child in it is made up.

It also keeps the business viable. Providers complain in public reviews about per-child pricing they found after a trial. With an open model, a day of reading costs a tenth of a cent hosted, or nothing locally, so I'd charge a **flat $9 a month for up to 12 children**. The open-source version stays free to self-host.

And openness lets anyone check the work. Every rule cites its regulation, every flag shows its evidence, and a provider can read the exact line of code that flagged them.

## My First User

I sent the demo link to Ravi on WhatsApp (first name only, with permission). Ravi opened it and wrote back: "Checked out the demo, super cool project!"

- **Would Ravi pay?** "$9 flat is honestly a steal, especially since everyone else charges per kid. Totally fair!"
- **What next?** "maybe a quick daily summary/report you can shoot to parents would be awesome."
- **The honest part:** Cubby already does that; the Parents tab writes each child's daily report. Ravi missed it, and when I pointed it out replied: "oh nice, my bad.good to know it already does that." So the parent report needs to be easier to find. Ravi's last message: "Let me know when it's fully ready to buy, definitely want to grab it!"

![The WhatsApp chat with Ravi, last name and profile photo blurred](https://cubby-daycare.onrender.com/shots/first-user.jpg)

## Prize Categories

- **Gemma:** Gemma 4 does all the reading. It's measured on the held-out days in the cloud (26B: 37/37, 4 false alarms) and locally (E4B: 37/37, 18), against Gemma alone (30/37, 72).
- **Render:** the live demo is a Render web service, built from the repo on every push.
- **ElevenLabs:** "Listen" reads the checked parent sheet aloud.
- **Sentry Agent Tracing:** every Gemma call is a `gen_ai.chat` span with model and token counts, and never note text or names.
- **Temporal:** sleep-check and late-pickup timers are workflows. With the worker killed mid-timer and restarted, a 20 s reminder still fired at 20.1 s (local dev server only).
- **Tinker:** a Qwen3.5-4B LoRA reader: 37/37 at 3.5 s per day, but 10 false alarms to Gemma's 4, so it's an experiment, not the default.
- **MongoDB Atlas:** stores only anonymous tester feedback, never child data.

**Honest limits:** I wrote the rules and the tests, and the generated held-out days share templates with the dev days (the two hand-written days don't). Only Massachusetts is encoded, minus one ratio clause. Whisper tiny mishears names, so notes stay editable. It isn't legal advice. And so far one person has tried the demo (above); nobody has used it on a real day yet.

*How I used AI: I picked this idea and directed the build. Claude Code wrote the code, generated the synthetic test days, ran the evaluations and drafted this post from the repo's results. Every child, adult and note in the demo and the tests is invented.*
