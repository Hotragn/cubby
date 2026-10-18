# Phone test: 3 minutes, real phone

Live link: https://cubby-daycare.onrender.com
Use the demo (fictional kids) only. Send the link to yourself in WhatsApp, then open it from there.

## A. WhatsApp in-app browser (tap the link inside a WhatsApp chat), about 60 s
1. **First screen:** the headline "…at Rosa's", 3 number tiles, "Over ratio right now" in red, and Mila and Theo listed. Nothing cut off at the sides, and no sideways scroll.
2. **Fix tab:** the first card is "2:45 pm–3:15 pm: 4 children under 2…", with 2 quoted notes and "606 CMR 7.10(4)". Scroll to the end and back: smooth, and the bottom note bar never covers a button you need.
3. **Answer a question:** on "Which child is 'the baby'?", tap **Mila**. Expect the toast: “the baby” means Mila for the rest of today.
4. **Mic button** (bottom bar): tap it.
   - If you see a permission prompt, allow it, hold the button and say: *"Theo had crackers for snack, ate most."* Release. The first time, a "Loading on-device speech model" bar shows (about 40 MB), then the text appears in the box. Tap ↑.
   - If no prompt appears, or you get a red message about the microphone, that's the expected fallback for in-app browsers. Type the same sentence and tap ↑ instead.
   - **Report:** prompt shown (yes/no), transcription text, seconds until the text appeared.
5. **Week tab:** five days are listed, and Thu and Fri show flags. Tap **Export week PDF**. Report whether a PDF opened, downloaded, or nothing happened.

## B. Brave (open the same link in Brave, or Brave's in-app view), about 60 s
Repeat 1, 4 and 5. Also:
- Brave Shields on: does the page load completely? (It uses Google Fonts and jsDelivr for the speech model.)
- **Parents → Ava →** "Write in Spanish". Expect a green "Every time and number matches the log" within about 5 s.
- **▶ Listen**: the voice plays.

## C. Real voice note in Safari or Chrome, about 60 s
1. Hold the mic and say naturally, with a made-up name from the demo: *"Ava and Leo napped one ten to two forty."*
2. Report the exact text that appeared (Whisper tiny can mishear names; "Leo" has come out as "Theo"). Fix any wrong name by hand, then tap ↑.
3. Today tab: the note shows chips like "Ava + Leo · 1:10 pm–2:40 pm".

## What to send back
For each of A, B and C: phone model and OS, pass or fail per step, a screenshot of anything that looks wrong, the mic result (prompt, text, seconds) and the PDF result.

## Already checked from the laptop (Oct 18)
- 375×812 with an Android Chrome user agent, 320×568, and a 328 px narrow pane: no horizontal scroll.
- `?micdenied=1` (a user who said "Don't allow"): a red message, and typing still works.
- `?novoice=1` (a browser with no microphone API, like some in-app browsers): the mic is dimmed and explains itself, and a typed note goes through Gemma.
- Whisper in the browser: a recorded 5-second note transcribed in 1.2 s after the model loaded.

**Not checkable from here:** the real WhatsApp and Brave in-app browsers, an iOS Safari user agent, a real microphone, and file downloads inside in-app browsers.
