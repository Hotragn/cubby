# FORUMS.md: what providers and parents actually say

Collected 2026-10-18. Rule for this file: every data point below was loaded by me from the URL given. Paraphrases are mine; quotes are exact and under 15 words. Nothing is invented. Where a source could not be loaded, it is listed under "Blocked / unverified" and not counted.

## Method and coverage (read this first)

| Source | Result |
|---|---|
| Reddit (r/ECEProfessionals, r/daycare, r/HomeDaycare, r/Parenting, r/beyondthebump, r/Nanny) | **Not loaded.** www.reddit.com JSON returned 403; old.reddit.com refused by fetch tool and by the browser pane; the pullpush.io archive returned 429 with a "no free scraping for agents" notice, so I stopped there. No Reddit quotes are in this file. |
| forums.daycare.com | **Not loaded.** Cloudflare bot verification page. I did not try to get past it. Search-engine snippets only (see bottom, unverified). |
| Capterra / G2 / GetApp | **Not loaded.** 403. Search snippets only, not used. |
| Apple App Store reviews | **Loaded.** Public customer-review RSS feeds for 6 apps: 2,403 reviews dated 2011-08-01 to 2026-10-16 (brightwheel 500, Procare 500, Lillio 500, Tadpoles Parent 500, Daily Connect 345, Childcare by Tadpoles provider app 58). These are the most recent ~500 per app, so older apps skew to older reviews. |
| CA licensing inspection reports (readyrule.com mirror of CA CCLD) | **Loaded** 3 reports. |
| Vendor blog / policy articles | **Loaded** 3 (Lillio, Wonderschool, New America). Vendor posts flagged as such. |

App Store review URLs: individual reviews have no permalink, so each item cites the app page plus the RSS feed I read, and the reviewer handle + date so anyone can find it.

- brightwheel (id 902823296): https://apps.apple.com/us/app/id902823296 / feed https://itunes.apple.com/us/rss/customerreviews/id=902823296/sortby=mostrecent/json
- Procare (id 1309822135): https://apps.apple.com/us/app/id1309822135
- Lillio, formerly HiMama (id 1098305044): https://apps.apple.com/us/app/id1098305044
- Daily Connect (id 502426621): https://apps.apple.com/us/app/id502426621
- Tadpoles Parent (id 428376881): https://apps.apple.com/us/app/id428376881
- Childcare by Tadpoles, provider app (id 434333524): https://apps.apple.com/us/app/id434333524

(Feed URL pattern for each: `https://itunes.apple.com/us/rss/customerreviews/page=N/id=<ID>/sortby=mostrecent/json`, N = 1..10.)

Themes: **T1** time/when providers write reports, **T2** what parents want / complaints, **T3** licensing records, **T4** price/fit for small home daycares, **T5** language.

## Data points

### T1: Time spent on reports, and when

1. **T1** | Lillio blog "10 Truths About Paper Daily Sheets", 2019-06-27 (vendor post) | https://www.lillio.com/blog/10-truths-about-paper-daily-sheets-no-one-wants-to-admit
   Paper sheets get filled in during downtime such as naptime or meals, from memory, which the post calls tedious and inaccurate. Gives no time figure.
   Quote: "naptime or while eating their meal"

2. **T1** | App Store, Lillio, "JR Koch and Family", 2023-09-11, 3 stars (teacher)
   A teacher says photo uploads are capped at 4 at a time, so keeping parents supplied with photos eats into supervision time.
   Quote: "I spend more time on this app instead of teaching"

3. **T1 / T2** | App Store, Daily Connect, "Vinny's mom 12", 2013-01-30, 5 stars (home daycare provider)
   Used to hand-write daily notes that parents barely read; now logs events as they happen and talks more at pickup.
   Quote: "the parents would hardly glance at them!"

4. **T1** | App Store, Daily Connect, "cricket1947", 2012-10-19, 5 stars (family daycare owner)
   Quick taps per event replace end-of-day recall of who ate what and whose diaper was changed.
   Quote: "No more trying to remember what each child ate"

5. **T1** | App Store, Daily Connect, "hugakeribear", 2015-07-24, and "AMButterflies", 2018-07-31 (both home providers)
   Both single out batch entry, logging several kids in one action, as the time saver. AMButterflies' review is titled "Good for sharing but can be time consuming".
   Quote (hugakeribear): "Select multiple kids at once"

### T2: What parents want in a report, and what they complain about

Counts over all 2,403 loaded reviews (regex over title+body, rough; a mention is not always a complaint): photos 689, notifications 156, meals/feeding 155, "real time"/"end of the day" 121, nap/sleep 97, diaper/potty 96, mood 7.

6. **T2** | App Store, Lillio, "Nicky102315", 2021-08-03, 5 stars (parent)
   Only diaper changes show times before the report is finalized; the parent plans the evening around nap timing.
   Quote: "We base our evening on when our child naps"

7. **T2** | App Store, Tadpoles Parent, "jdmrosa", 2018-04-12, 2 stars (parent)
   Wants nap and meal info live, not only after the teacher sends the end-of-day report, to time pickup around naps.
   Quote: "I might slightly adjust my pick up time if he is napping"

8. **T2** | App Store, Tadpoles Parent, "Msmerelee", 2019-10-23, 3 stars (parent)
   Report groups diapers, meals and naps into separate sections; parent wants one chronological timeline to see why baby didn't eat.
   Quote: "see it in chronological order"

9. **T2** | App Store, Procare, "Kadz B", 2026-08-20, 2 stars (parent)
   Push notifications are not real-time and the daily summary should compute totals rather than make parents add them up.
   Quote: "show me total nap time"

10. **T2** | App Store, Lillio, "Nward914", 2021-10-07, 2 stars (parent of infant)
    Report shows diapers and naps but not feeding time and amount, which matters most for a baby.
    Quote: "it needs to report when and how much the baby ate"

11. **T2** | App Store, brightwheel, "EdCorcoran", 2026-03-03, 3 stars (parent)
    Wants pushes for messages and photos only, not every routine event; also wants to pre-enter last feed/nap/diaper before drop-off.
    Quote: "I don't need a notification for every nap, meal or diaper change"

12. **T2** | App Store, Procare, "marcast99999", 2026-08-02, 1 star, and "JP reviewz", 2026-10-07, 2 stars (parents)
    One gets 50+ daily emails duplicating push alerts with no opt-out; the other says announcements buzz as urgently as important updates.
    Quote (marcast99999): "50+ daily email that you cannot opt out of"

13. **T2 / T3** | App Store, Tadpoles Parent, "Zeek J", 2024-02-21, 3 stars (parent)
    Son had an incident; it was logged in the app but parents only learned of it after pickup because updates are end-of-day.
    Quote: "we found out about it only after picking him up"

### T3: Licensing records and inspections

14. **T3** | CA CCLD inspection via readyrule.com, Forcella FCCH (family child care home), Solano CA, routine inspection 2024-01-04 | https://readyrule.com/daycare/483009518-forcella-sherrie-fcch/report/2024-01-04
    Three Type B citations: no infant sleep log (102425(j)(2)(D)), assistant lacked mandated-reporter certificate, two children lacked emergency cards (LIC 700).
    Quote: "the licensee was not keeping a sleep log for infant in care"

15. **T3** | CA CCLD via readyrule.com, James FCCH, routine inspection 2023-10-16 | https://readyrule.com/daycare/483010237-james-bethany-fcch/report/2023-10-16
    Two Type B citations: immunization forms missing for all 3 children; sleep log kept for only one infant and missing the time of each 15-minute check.
    Quote: "not documenting sleep log for all infants in care"

16. **T3** | CA CCLD via readyrule.com, Carrie's Childcare Connection, complaint inspection 2021-05-27 (likely a center; cited sections are center rules) | https://readyrule.com/daycare/163801784-carries-childcare-connection/report/2021-05-27
    Type A ratio citation (18 children, one staff; limit 14) and Type B sign-in/out citation because staff, not parents, signed children in and out.
    No short quote used.

17. **T3** | App Store, Tadpoles Parent, "LLL702", 2017-08-17, 1 star (parent)
    Says drop-off and pick-up times in the app don't match actual times; wants staff to enter on a device in the moment.
    Quote: "drop off and pick up are not accurate"

18. **T3** | App Store, Daily Connect, "c_choff", 2014-08-11, 5 stars (home daycare provider)
    Wants the attendance report to line up times with meals so she can check her food-program claims; Excel export gave trouble.
    Quote: "cross reference the times and meals to double check for the food program"

### T4: Price and fit for small home daycares

19. **T4** | App Store, Childcare by Tadpoles (provider app), "SeXy SwatPup", 2013-03-18, 4 stars (small daycare)
    Learned only after the 14-day trial that it was $2.25 per child per month; fine for big centers, pricey for small in-home ones.
    Quote: "for a small daycare it's kind of pricey"

20. **T4** | App Store, Daily Connect, "Littlefeet Daycare", 2018-02-02, 5 stars (provider)
    Previously used brightwheel; cost was the reason she left. Parents use her logs at doctor visits for eating, sleep and constipation.
    Quote: "What I didn't like about it is the cost."

21. **T4** | App Store, Daily Connect, "QueenMeka0414", 2023-08-25, and "J3SSICA7", 2024-07-23 (providers)
    In-home providers stay with Daily Connect for low price; J3SSICA7 says it has the features "of the more expensive apps".
    Quote (QueenMeka0414): "There prices are extremely affordable as well!"

22. **T4** | App Store, Lillio, "daycareprovider", 2021-10-04, 2 stars (director)
    Gets logged out several times a day mid-documentation; feels that isn't acceptable at the price.
    Quote: "For the price of this app I'm not impressed"

### T5: Language and translation

23. **T5** | App Store, Tadpoles Parent, "HeliVero", 2025-08-20, 1 star (adult child of Spanish-reading grandparents)
    Grandparents read the app in Spanish; a notice that one child was "out" with hand-foot-mouth was machine-translated as a child having died.
    Quote: "1 child "out" with…was translated to "died""

24. **T5** | Wonderschool blog "Spanish Language Support on Wonderschool", 2021-02-19 (vendor post) | https://wonderschool.com/blog/child-care-provider-resources/spanish-language-support-on-wonderschool
    Reports that about half of home-based directors on its own platform speak Spanish as their primary language; translated dashboard and app. Platform sample, not national.
    Quote: "about 50% speak Spanish as their primary language"

25. **T5** | New America, "Supporting Linguistically Diverse Family Child Care Providers", Nicole Hsu, 2023-01-17 | https://www.newamerica.org/insights/supporting-linguistically-diverse-family-child-care-providers/
    Summarizes a 2022 study of 28 Chinese-, Tagalog- and Spanish-speaking CA family child care providers: those without written translations of training and regulatory documents struggled more.
    No short quote used.

## Blocked / unverified (not counted above)

- forums.daycare.com threads surfaced by web search ("When To Give Up The Daily Report?", "Do You Write A Daily Report?", "Daily Reports", "Sign in Sheets"): https://forums.daycare.com/forum/main-category/daycare-center-and-family-home-forum/15763-when-to-give-up-the-daily-report and siblings. The search engine's snippet attributed to a provider spending "an hour" on reports after the kids left and parents not reading them. **I could not load the pages (Cloudflare), so do not quote this in the post** unless someone opens it in a normal browser and confirms.
- Capterra Daily Connect reviews: search snippet mentions a price change to per-child billing. Page returned 403; not verified.
- Reddit: nothing loaded. If the post needs Reddit voices, open the subreddits by hand in a logged-in browser and paste the threads in.

## What this means for the product

1. **Log as it happens, one tap, batch by default.** The time savings providers praise come from tapping events live and selecting several kids at once (items 4, 5), not from a nicer end-of-day form. Nap, meal and diaper entries must work for "all sleeping kids" in one action.
2. **The report writes itself from the log; nap time is for review, not data entry.** Paper sheets get filled at naptime from memory (item 1). The end-of-day report should already be 90% done from taps, so the provider only adds a sentence or a photo, on a phone, in under a minute per child.
3. **One chronological timeline with computed totals.** Parents want times and totals (total nap, when and how much baby ate), in order (items 6, 8, 9, 10). Show "last ate / last nap / last diaper" at the top.
4. **Parents choose what buzzes.** Default to messages, photos, incidents and pickup-relevant changes; roll routine events into a digest. Never send email duplicates without an off switch (items 11, 12).
5. **Incidents and meds push immediately, and need parent acknowledgement.** An incident discovered only after pickup is a trust failure (item 13). Incident and medication entries should notify right away and capture a parent acknowledgement for the licensing file.
6. **Licensing logs are a by-product of the same taps.** Inspectors cite missing infant sleep logs, missing 15-minute check times, wrong signer on sign-in/out, and missing emergency/immunization forms (items 14 to 16). Sleep checks need a 15-minute timer with timestamped "checked" taps, sign-in/out must capture the parent as signer with time, and there should be a one-screen "inspection ready" export by date range plus a missing-forms checklist per child.
7. **Flat, small-program pricing stated up front.** Home providers left or complained over per-child pricing found after a trial (items 19, 20, 21). Say the price for a 6 to 12 child home daycare on the first screen.
8. **Translation must be reviewed for safety words.** A machine translation turned "out sick" into "died" (item 23). Translate parent-facing reports with a fixed, human-checked glossary for status words (out, absent, sick, sent home, injured), show the original English one tap away, and let providers write in their own language (items 24, 25).

## Test script tweaks

- **Nap-time test:** with 6 children seeded, time how long a provider takes to finish all 6 reports on a phone during a simulated 20-minute nap. Pass if done with time left and nothing typed from memory.
- **Batch tap test:** log "lunch, all ate most" and "nap start" for 5 of 6 kids in one action each. Count taps.
- **15-minute sleep check test:** start a nap for an infant; confirm the app prompts every 15 minutes and the export lists each check's time. Skip one check and confirm it shows as a gap, not silently filled.
- **Sign-in signer test:** check a child in as the provider; confirm the record flags that the parent did not sign, or the flow requires the parent.
- **Incident test:** log a minor bump at 10:05; confirm the parent gets a push within a minute, can acknowledge it, and the acknowledgement appears in the licensing export.
- **Notification settings test:** as a parent, mute routine events and keep photos/messages/incidents; run a full day; count pushes and emails received.
- **Timeline test:** parent view must show events in time order with "total nap" and "last fed (amount)" at the top.
- **Translation test:** send a closure notice containing "1 child out with hand, foot and mouth" in Spanish and one other language; a native speaker checks it does not say a child died or was removed. Repeat with "sent home sick" and "absent".
- **Pricing test:** a new user must find the monthly price for 8 children without signing up or starting a trial.
- **Inspection export test:** generate a date-range PDF of attendance with signers, sleep checks, meds and incidents; hand it to someone who has never seen the app and ask them to find a specific child's Tuesday sleep checks in under 30 seconds.
