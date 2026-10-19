*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

It's 2:45 on a weekday afternoon at a home daycare. Two toddlers have just woken up, the baby is fussing, and the assistant heads out for the school run. The provider taps a quick note into her phone: "Dana out for school run."

There are four kids under two in the house. In Massachusetts, one adult can look after up to six children, but [no more than three of them under two](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10). So for the next half hour the house is out of ratio, and nobody notices. It's right there in the notes. It's just not anywhere anyone will look.

Earlier that day, 35 minutes went by without anyone checking on the sleeping baby. The rule is every 15. That's in the notes too.

(Rosa, Dana and the kids are made up. So is every test day in this post.)

I built **Cubby** to read those notes. On 14 test days I'd set aside before running anything on them, it caught all 37 problems I'd planted, with 4 false alarms. When I gave the same AI model the same notes and asked it to find the problems itself, it caught 30 and raised 72 false alarms.

## What I Built

Running a licensed daycare out of your own home is a classic side hustle, and it comes with a lot of paperwork. Child Care Aware of America counted [94,227 licensed family child care homes in 2023](https://www.childcareaware.org/?p=76062), across the 39 states that reported numbers.

Every day, a provider owes each parent a short report (what they ate, how long they slept, diapers, mood) and owes the state inspector exact logs: sign-ins, sleep checks, medicine, injuries, ratios. Most of it gets written from memory at nap time, or in an app. Here's what the apps publish for pricing (as of Oct 18):

| App | Published price |
|---|---|
| [Daily Connect](https://en.dailyconnect.com/pricing) | $8.99/mo up to 3 kids, $12.99/mo up to 6, or $16/mo billed yearly for 10 kids + $1.60 per extra kid |
| [Famly (US)](https://www.famly.co/us/pricing) | from $49/month |
| [Brightwheel](https://mybrightwheel.com/pricing), [Procare](https://www.procaresoftware.com/pricing/), [Lillio](https://www.lillio.com/features/pricing), [Playground](https://www.tryplayground.com/pricing) | contact sales |

None of those pricing pages mention checking medication consent or incident reports against the rules. That's the stuff inspectors actually write people up for. Public California inspection reports show home daycares cited for [having no infant sleep log](https://readyrule.com/daycare/483009518-forcella-sherrie-fcch/report/2024-01-04) and for [leaving out the time of each 15-minute check](https://readyrule.com/daycare/483010237-james-bethany-fcch/report/2023-10-16).

Here's how a day goes with Cubby:

1. **You jot notes as things happen**, typed or spoken. "Ava and Leo napped 1:10 to 2:40" is one note about two kids. Speech-to-text (Whisper) runs on the phone itself, so the audio never leaves it.
2. **Gemma reads each note** and turns it into log lines (meals, naps, sleep checks, diapers, injuries, medicine, pickups), each with the exact words it came from. If a note is unclear, like "the baby had a 4 oz bottle", it asks which child instead of guessing.
3. **Plain code checks the log** against Massachusetts' family child care rules ([606 CMR 7.00](https://www.law.cornell.edu/regulations/massachusetts/606-CMR-7-10)):
   - sleep checks at least every 15 minutes
   - the ratio, minute by minute
   - medicine only with a current signed consent and a matching dose
   - an incident report for every injury (Cubby pre-fills it)
   - every child signed in and out to someone on their pickup list
   - late pickups, and times that don't add up

   Every warning shows the note behind it, the rule, and what to do about it.
4. **Each parent gets a daily report.** Gemma can make it warmer or translate it, but code checks every time, number, food and health word against the log before anyone sees it; if anything doesn't match, you get the plain version. Injuries and medicine are never reworded, and one parent's report never names another child ("Another child bit Leo on the arm…"). That last part came from reading reviews: in one [public App Store review](https://apps.apple.com/us/app/id428376881) of a different daycare app, a Spanish translation turned a child who was "out" sick into a child who had "died".
5. **The inspector's log** for the day or the week exports as a PDF or CSV, and every line keeps the note it came from.

It also works for a real program, not just the demo. Under "My program" you add your own kids (birthdays, allergies, medicine consents, photo consent, who can pick them up), your staff, and your rules, which start at the state's numbers. It all stays on your device. If Gemma asks "which child is 'the baby'?" you tap Mila once, and the rest of the day "the baby" means Mila. There's a week view too.

## Demo

**[cubby-daycare.onrender.com](https://cubby-daycare.onrender.com)** is a one-page explainer. Tap **Try the demo day** and the app ([/app](https://cubby-daycare.onrender.com/app)) opens with a three-step tour of a made-up day at Rosa's: you send a note and watch it become a log line, then see the 8 things an inspector would flag and Ava's finished report. The **?** button replays the tour. It's built for a phone.

![The app on a phone: Rosa's made-up day, 39 notes, 46 log lines, 8 things to fix](https://cubby-daycare.onrender.com/shots/home.jpg)

![A note you send becomes a log line](https://cubby-daycare.onrender.com/shots/tour-note.jpg)

![The ratio problem, with the two notes that prove it and the rule](https://cubby-daycare.onrender.com/shots/tour-fix.jpg)

![Ava's report in Spanish, checked against the log; the incident line stays exactly as written](https://cubby-daycare.onrender.com/shots/sheet.jpg)

![The week at a glance, with a weekly export for the inspector](https://cubby-daycare.onrender.com/shots/week.jpg)

![Running fully on my laptop: Gemma 4 E4B read "Theo down for nap now" and a Temporal timer raised the sleep-check reminder (sped up for the demo)](https://cubby-daycare.onrender.com/shots/timers.jpg)

## Code

It's all on GitHub: [github.com/Hotragn/cubby](https://github.com/Hotragn/cubby). The interesting parts are the rule checks (`public/lib/rules.js`), the Massachusetts rules with their citations (`public/lib/states.js`), the prompt Gemma reads notes with (`src/gemma.ts`), and the tests (`evals/`, written up in `docs/REPORT.md`).

## How I Built It

The whole design comes down to one split: **the AI reads, the code decides.** I didn't want a language model deciding whether a baby's nap was supervised safely. So Gemma's only job is to turn "checked all 1:40" into `{"type":"sleep_check","kids":["all"],"time":"1:40"}`, and even that gets double-checked. Names have to be on the roster, times have to make sense (providers write "1:10" meaning 1:10 pm, and Whisper writes it as "110"), and the quoted words have to actually appear in the note. After that, about 250 lines of plain rule code do the checking, right in the browser.

There's a safety net too. Code scans every note for injury and medicine words, so "goose egg on his forehead" still raises a warning even if Gemma misses it.

**Testing it honestly.** I wrote a generator for made-up days with problems planted in every rule type, plus two days I wrote by hand in a messy, spoken style ("um Clara had her Motrin three ml at like 10:15 I gave it"). The first 12 days were for finding bugs, and they found real ones: "had a few bites" of toast counted as an injury, and a 06:59 sign-in was read as 6:59 pm. Once I'd fixed those, I saved a separate set of 14 days, with the answer key, before running anything on it.

| 14 set-aside test days, 37 planted problems | Caught | False alarms |
|---|---|---|
| Cubby (Gemma reads, code checks) | **37** | **4** |
| Gemma alone (same notes, same rules written out in plain English) | 30 | 72 |

The first run on those days caught all 37 with 6 false alarms. Two of them were "grapes cut in quarters" tripping my injury-word check, which I fixed after seeing it. The other 4 are real weaknesses: a pretend doctor kit, "Bodhi's mom here" not being read as a sign-out, diaper cream logged without a dose, and a pickup note that didn't say who it was. Gemma on its own missed 3 of the 4 ratio problems (it doesn't count heads minute by minute) and a whole day of 20-minute sleep-check gaps. To be fair to it, it used about a quarter of the tokens and caught every injury. The full write-up is in `docs/REPORT.md`.

Speed and cost for a day of notes (about 27 of them):

- **In the cloud** (Gemma 4 26B A4B): 34 to 39 seconds. That's [free on Google AI Studio's free tier](https://ai.google.dev/gemini-api/docs/pricing), or about a tenth of a cent at [OpenRouter's price](https://openrouter.ai/google/gemma-4-26b-a4b-it).
- **On my laptop** (Gemma 4 E4B through Ollama on an M4 Mac, inside the real app): 162 seconds for the demo day's 39 notes, with all 9 planted problems flagged. On the test days it also caught all 37, but with 18 false alarms. The small model misses more wake-up times and pickups, and the code then flags those as missing.
- **A fine-tuned 4B model** (Qwen3.5-4B with a LoRA trained on [Tinker](https://thinkingmachines.ai/tinker/), from Gemma's own reading of 1,291 separate made-up notes): all 37 caught with 10 false alarms, in 3.5 seconds a day.

The front end is React with a few [React Bits](https://github.com/DavidHDev/react-bits) components, on a small Node server.

## Why Does Open Innovation Matter?

Because this is children's data. Nap times, diapers, injuries and medicine are about as private as a small business's records get.

With an open model, the whole thing can run on the provider's own laptop: Gemma through Ollama, Whisper in the browser, and the checks in the page. Nothing leaves the house. The hosted demo only uses Google's cloud because every child in it is made up.

It's also what makes the price work. Providers complain in public reviews about per-child pricing they only found out about after a trial. When a day of notes costs a tenth of a cent to read in the cloud, or nothing locally, I can charge a flat $9 a month for up to 12 kids, and it stays free if you run it yourself.

And because it's open, anyone can check the work. Every warning cites its rule and shows its evidence, and a provider can read the exact line of code that flagged them.

## My First User

I sent the demo to Ravi on WhatsApp (first name only, with permission). Ravi's first reaction: "Checked out the demo, super cool project!"

On price: "$9 flat is honestly a steal, especially since everyone else charges per kid. Totally fair!"

On what to build next: "maybe a quick daily summary/report you can shoot to parents would be awesome." Cubby already does that; the Parents tab writes each child's daily report. Ravi just hadn't found it ("oh nice, my bad.good to know it already does that."), which tells me that report needs to be much easier to find. Ravi's last message: "Let me know when it's fully ready to buy, definitely want to grab it!"

![The WhatsApp chat with Ravi, last name and profile photo blurred](https://cubby-daycare.onrender.com/shots/first-user.jpg)

## Prize Categories

- **Gemma:** Gemma 4 does all the reading, measured in the cloud (26B: 37/37, 4 false alarms) and on a laptop (E4B: 37/37, 18) against Gemma on its own (30/37, 72).
- **Render:** the live demo runs on Render and redeploys from the repo on every push.
- **ElevenLabs:** a "Listen" button reads the finished parent report out loud.
- **Sentry Agent Tracing:** every Gemma call is traced with its model and token counts, and never the note text or names.
- **Temporal:** sleep-check and late-pickup reminders run as workflows. I killed the worker partway through a 20-second timer and restarted it, and the reminder still fired at 20.1 seconds (local dev server only).
- **Tinker:** I fine-tuned a Qwen3.5-4B reader. It's 10 times faster but noisier (10 false alarms to Gemma's 4), so it's an experiment, not the default.
- **MongoDB Atlas:** it stores anonymous feedback from testers and nothing about children.

A few honest limits. I wrote both the rules and the tests, and the generated test days share templates with the days I debugged on; only the two hand-written days are truly new. Only Massachusetts is in so far, minus one ratio rule. Whisper sometimes mishears names, so notes stay editable before you send them. It isn't legal advice. And so far one person has tried the demo; nobody has used it on a real day yet.

*How I used AI: I picked the idea and directed the build. Claude Code wrote the code, generated the made-up test days, ran the tests, and drafted this post from the results. Every child, adult and note in the demo and the tests is invented.*
