# Daily Dose: continuous improvement loop

## Goal
Make Daily Dose look hand-crafted (never AI-generated) and make it something people come back to every day because they enjoy it, not because they are pushed.

## The loop (repeat until stopped)

1. **Audit for the "AI look".** Screenshot every screen at phone size (390px and 320px). List anything that reads as generated or generic, for example:
   - stock layouts (a centred hero, then three rounded cards), gradient blobs, glassy everything
   - default spacing and type scales; every element the same weight; no point of view
   - generic copy ("Unlock your potential", "Seamless", em-dash-heavy sentences), emoji used as icons
   - perfect symmetry with no texture, no detail, no surprise
   - motion that is decorative rather than meaningful
   Check against current write-ups on how people spot AI-made design, and against Job's own apps (KeepUp, JobDone), which set the bar.

2. **Research what keeps players coming back.** Study games that people return to daily (NYT Games: Wordle, Connections, Strands; LinkedIn games; Krillion; Duolingo; GeoGuessr; Balatro) and current writing on habit loops, game feel and retention. Note what each does well and how it could apply here.

3. **Pick the highest-impact change and build it.** Prefer one finished, polished improvement over several half-done ones. Each change must work at 320px and 390px, keep 60fps on a mid-range phone, respect "reduce motion", and keep AA text contrast.

4. **Verify.** Run the tests and build, open the real app, screenshot the changed screens, and compare against the audit list. Fix anything that regressed.

5. **Record.** Add a line to the log below: what changed, why, and what's next. Commit on the working branch.

## Guardrails (always)
- **Healthy engagement, not dark patterns.** Players include teens. No loot boxes or gambling-style rewards, no paid streak saves, no fake scarcity, no fake player counts, no guilt-trip notifications, no infinite feeds. Streaks stay forgiving (free freezes). One new puzzle a day is the point: finishing should feel complete, not leave people wanting to grind.
- **Honest numbers.** Never show invented stats. Hide counts that are too small to mean anything.
- **Don't push live without Job's OK.** Commit locally; Job approves pushes (a push deploys the live site).
- Don't change game rules, free vs Pro, the name, or anything that costs money without asking.
- Keep Job's style rules: no purple-gradient/three-card look, no lime green, plain human copy, phone first.

## Log
- 2026-10-25: Night-city identity across home, Rewire and Hunch (sky, skyline with a neon sign per game, buildings light up as you finish games). Live "playing tonight" count from the server, hidden below 25 players.
- 2026-10-25 (cycle 2): Audit found the classic AI tell: every game in its own rounded card. Replaced the card stack with one lit "Next up" marquee (one main action) plus a ruled building directory; unopened games show as unlit outline signs. Buildings in the skyline open their game. Added a live "Tomorrow's puzzle in" countdown to results (something to come back for). Redrew the Hunch icon (it read as a warning sign). Next: image share cards (9:16 story + square) in the night-city style.
- 2026-10-25 (cycle 3): "Tonight's Dose" share image (9:16 story and square) drawn on a canvas in the night-city style: sky, moon, a neon sign per finished game with the result, skyline with lit windows, the site address. Spoiler-free. Shares through the phone's share sheet (image + text); on computers it saves the image and copies the text. Share buttons on both result screens and the home screen use it. Next: first-time "how to play" for Hunch, and a quick audit of copy on every screen.
- 2026-10-25 (cycle 4): Hunch had no intro and quietly signed people in as guests the moment the screen opened. Added a short intro ("How close can you get?", 5 questions · 1 guess each · ~2 minutes) with a Start button; nothing loads or signs in until you tap it. Copy check on all screens: plain words, no filler. Next: the free weekly streak freeze from the brief, so one missed night doesn't wipe a streak.
- 2026-10-25 (cycle 5): Free weekly streak freeze (from the brief): one missed day per Monday–Sunday week is skipped automatically if you played the day before; two misses in a row still end it. Tested (tests/streak.test.js). Next ideas, in order: show the freeze on the home screen ("freeze used" / "1 left this week"); Rewire's optional hint; badges; then the next game (Drop) once Job has reviewed the night-city look.
