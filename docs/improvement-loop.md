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
