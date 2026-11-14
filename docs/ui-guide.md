# Daily Dose UI guide (Job, 2026-11-14)

Pasted by Job in chat. The end of section 11 was cut off in the paste. On top of this guide, Job's own direction is a **coffee / café theme** (see notes at the bottom).

## 0. Before you start
Read the game code that already exists and don't change game rules or logic. Your job is the visual layer: layout, styling, animation, sound and haptics. If a UI change needs a logic change, ask first.
Read ~/.claude/anti-slop.md before designing anything, and use the emil-design-eng, animate, apple-design, mobile-native and frontend-design skills.
Fake data is fine for anything not built yet (world percentages, top answers, where everyone banked, friends). Keep all mock data in one clearly named file so it's easy to swap later.
Show screenshots or a short screen recording after each step. Don't call a screen done until it's been opened at phone size in a real browser and looked at.

## 1. The feeling
Daily Dose is a daily games hub, like NYT Games: 6 short games, a new one of each every day, the same for everyone. The UI should make people say "this feels SO smooth", "I need to screen-record this", "how did I miss blender??", "only 8% got it and I did".
Reference: Krillion (krillion.io): buttery animations, and the score shown as a journey you can see instead of a plain number. Match that polish. Do NOT copy Krillion's look, ocean theme, layout or colours.
Avoid the generic AI look: no purple-to-blue gradients, no three rounded feature cards, no glassmorphism everywhere, no default grey-on-white, no emoji as icons in the real UI (emoji are fine in share text).

## 2. The roster (6 games)
| Game | Input | Feeling | Time |
|---|---|---|---|
| Blend | typed | Mind-reading | 5 prompts × 20 s |
| Rush | typed | Panic | 30 s |
| The Shot | typed | Snap reflex | 7 s |
| Drop | tap | Nerve | 7 s per call |
| Missing Link | typed | The "aha" | untimed |
| Ladder | typed | Calm | untimed |
Four of the six are typed, so the typing experience is the most important piece of UI (section 5).

## 3. Design system (build first)
One token file (CSS variables) used everywhere.
Hub identity: confident and playful, like a premium arcade. Suggest 3 clearly different directions (palette, fonts, a sample hub screenshot for each); Job picks.
Per-game moods inside the hub identity:
- Blend: mind-reading, social. Two-sided: warm "everyone" colour + sparkly "no one" colour.
- Rush: panic, heat. Hot reds/oranges that intensify as time runs out.
- The Shot: one sharp moment. Near-black with one hard spotlight colour.
- Drop: nerve, money on the line. Deep green felt + gold for the pot.
- Missing Link: the "aha". Dusk blue that brightens as clues appear.
- Ladder: calm. Soft paper tones, muted, lots of white space.
Type: a display font with character for big numbers and titles + a clean UI font. Self-host. Tabular figures for numbers.
Tokens: colours (light + dark for the hub; games may be dark-only), type scale, spacing, radii, shadows, motion durations and easing, z-index layers.
Components: primary/secondary button, icon button (with label), game tile, answer input, answer chip, timer (bar, ring, digits), stat block, percentage bar, result card, share card, toast, bottom sheet, modal, countdown, streak flame, badge, skeleton loader, friend chip.

## 4. Motion, sound and haptics
- Most UI animations ~150–250 ms. Springs for things you touch, ease-out for things that appear.
- Buttons shrink on press (~0.96) and spring back.
- Numbers never jump: scores, timers, percentages, pots roll.
- One big celebration per game, only for its biggest moment. Everything else calm.
- Interruptible animations. Respect Reduce Motion (fades instead), pause heavy effects in battery saver.
- 60 fps on a mid-range Android. Transform + opacity; Canvas only if a scene needs it. animation-performance skill if anything stutters.
- No white flash on load: loading screen matches the hub.
- Sound: tap, correct, wrong, tick, reveal whoosh, celebration + 1–2 signature sounds per game. One remembered mute switch in the hub. Free sounds only, licences in sounds/LICENSES.md.
- Haptics on correct, wrong and key moments (Vibration API).

## 5. Typing UI (Blend, Rush, The Shot, Missing Link, Ladder)
- Big, centred, auto-focused input; keyboard opens immediately and never covers the input or timer (visual viewport on Android).
- Enter submits. Correct = answer flies into place as a chip with a soft pop. Wrong/invalid = short horizontal shake + red flash, text stays.
- Duplicates (Rush): "already got it" + bounce the existing chip.
- No autocorrect/autocapitalise/spellcheck on game inputs.
- No zoom on focus, no layout jump when the keyboard opens.
- Optimistic: input stays usable while a submission is checked; never block typing on the network.

## 6. The hub
- Top: "Daily Dose" wordmark, date, streak flame (grows with streak, gentle flicker), countdown to tomorrow in rolling digits.
- Six tiles, own colours, tiny looping idle animation each: Blend (two blobs, one with the crowd, one drifting off), Rush (timer sliver pulsing), The Shot (spotlight flicking), Drop (coin flipping), Missing Link (link pieces clicking), Ladder (letters swapping one at a time).
- Tile states: Play (inviting), Done ✓ with mini result (calm), "Friend beat you" badge.
- One obvious main action: the next unplayed game is the most prominent tile. Suggested order: The Shot first (warm-up), Ladder last (cool-down).
- All six done: "Dose complete" moment + combined share card button.
- Tapping a tile grows it into the game screen (shared-element transition).

## 7. Per-game UI
Same shell for every game: intro card (name, today's #, one-line how-to on first play only, big Play) → play screen (full focus) → reveal (most polished) → result card (score, "Top X%", streak, Share, Back to hub) → share card (9:16 story + square + spoiler-free text).

**Blend**: each prompt shows its mode, "Think like everyone" (warm, many dots) or "Think like no one" (sparkly, lone dot); the switch is unmistakable. 20 s ring timer around the card. After each prompt your answer's % rolls up, then the top 3 answers slide in as bars. "Rare find" (answer under 1%) = big celebration: gem burst, shine sweep, chime, strong haptic. Result: 5 squares building one by one, then "Top 8%". Share: `Blend #14 · 🟩🟨🟥🟩🟪 · Top 8%`

**Rush**: category in big type. Thick shrinking timer bar; last 10 s the palette heats up, bar pulses, ticking speeds up. Valid answers pop into a growing chip pile; rare answers get a 💎 chip with sparkle. Count rolls up. Time's up: input locks with a hard stop sound. The sting: total + rare count, then the most common missed answer slams in ("You missed: blender. 82% got it."), then other common misses. Share: `Rush #14 · 14 found · 3 rare 💎`

**The Shot**: question appears with a spotlight-on effect. Big 7 s countdown with heartbeat pulse. Instant verdict, answer + % who got it ("Only 8% got today's shot."), your time ("in 4.2 s"). Under-10% shot = big celebration. Share: `The Shot #14 · ✅ in 4.2s · 8% got it`

**Drop**: card with current item/number; Higher / Lower buttons; 7 s per call. Pot centre stage doubles each correct call (rolling number, coins stacking, rising tension). Bank button glows more as the pot grows; banking = coins slide into your bank + cash sound. Wrong = pot shatters, heavy sound + haptic. Reveal: chart of where everyone banked + where the chain went ("Most people banked at 4. The chain went to 9."), your bank point marked; if bust, what you'd have had banking one step earlier. Share: `Drop #14 · 🟩🟩🟩🟩🟩💰 Banked 320`

**Missing Link**: clues flip in one at a time; guess any time or reveal next. Wrong guesses shake and stay faintly visible. Aha: answer slides in and visibly joins each clue (CUP + CAKE, BUTTER+CUP) with a click per link. Clue 1 solve = big celebration; result shows which clue. Share: `Missing Link #14 · got it on clue 2 🔗`. (Content: every puzzle's clues must join the answer the same way.)

**Ladder**: start word top, target bottom, rungs between. Valid step adds a rung with changed letter highlighted; invalid shakes. No timer, soft sounds, space. Par shown from the start. At/under par = gentle big celebration. After: shortest path next to yours ("You took 6. Par was 4.") drawing in rung by rung. Share: `Ladder #14 · 4 steps · par 4 ⛳`

## 8. Streaks, badges, friends (UI only)
Flame grows at 7, 30, 100 days; freeze icon when a freeze is available. Badge unlock: card flips in with a shine sweep; grid with locked silhouettes. Ideas: first Rare find, Shot under 10%, Missing Link on clue 1, Ladder under par, banked 1,000+ in Drop, Rush 20+. After a game, friends list (mock) with mini results.

## 9. Accessibility and phone polish
44×44 tap targets; contrast checked in every palette. Largest system text size works. No double-tap bugs (disable while pending, esp. Bank, Higher/Lower). No sticky hover, no tap flash, safe areas, status bar colour per screen. Labels on icon buttons; screen-reader labels; timers announce remaining time at key points.

## 10. Order of work
1. Design system: 3 hub directions → Job picks → tokens + core components on one "kitchen sink" page.
2. Hub: tiles, idle animations, streak, countdown.
3. Shared game shell + shared typing UI.
4. The Shot. 5. Blend. 6. Rush. 7. Drop. 8. Missing Link. 9. Ladder.
10. Streaks, badges, friends, "Dose complete".
11. Sound + haptics pass.
12. Polish: review-animations + make-interfaces-feel-better on every screen, real Android phone, fix anything under 60 fps.
After each step: screenshots or a recording, wait for Job's OK.

## 11. How to work with Job
Not a professional developer: short, plain updates. Choices with pictures, not walls of text. Ask before changing game rules, adding large libraries, or anything tha… (cut off in the paste)

## Job's coffee direction (2026-11-14)
- Lean into "coffee shots", not the NYT newspaper look. Instrument Serif "looks so AI".
- Liked mockup C (top-down cup) for personality.
- Cartoony, animated, fun; no plain backgrounds: a café scene.
- Cartoon café + pixel-art customers seen through a glass front and door; viewpoint behind the counter (barista); 6 cups on the counter under/near the espresso machine, one per game, fill when solved, tap to play; chunky rounded display font.
- Earlier mockups: claude.ai/artifact/MJYpJLLhykBrgKwgCYxUn2

## Decisions from Job's Q&A (2026-11-14)
- Lineup: design for the guide's 6 (Blend, Rush, The Shot, Drop, Missing Link, Ladder) with mock data. Building Rush/The Shot and reviving Drop is separate game work, later.
- 3 hub directions span cosy → café-arcade, one font each (soft retro serif, hand-painted sign, bubbly rounded sans).
- Time of day follows the player's clock; it is also the theme (day = light, evening = dark), with a manual override.
- Customers: friends stand at the window with names (tap for result); the street crowd behind scales in tiers with today's player count (never 1:1); the real number on a chalk A-board; NPC regulars fill in for players with few friends.
- Journey (Krillion idea): serving the queue. Each finished game = a drink handed to the next customer; the queue shrinks, the tip jar fills.
- Game moods: mix of diving into the cup into that game's own world, and the café light/cups taking on the game's mood.
- Idle animations: latte art in the foam and/or the cup sleeve.
- Dose complete: cosy Saturday afternoon and shareable. Mockups try polaroid on the regulars' wall / loyalty card stamped / window seat.
- Opening a game: dive into the cup or cup slides forward (try both).
- Layout: café scene fills the first screen, cups and the main action low in thumb reach; scroll down for friends, streak, badges (needed for largest text size).
- Characters: you are the barista (no visible character); a cute café cat on the counter; a dog (maybe a Rottweiler) by the door.
- Sound: soft café ambience on by default on the hub (starts after the first tap; browsers block autoplay), mute remembered.
- Play order: players choose; the next unplayed cup is highlighted.

## Home screen decisions (Job, 2026-11-14, later)
- Pixel art everywhere, one style: room, people, animals, machine, glasses. Mockup: design/cafe/4-pixel.html on art/corner-day.png.
- The six games are **shot glasses**, not drinks. Every glass starts empty. Picking a game spins its glass into the espresso machine under the spout; the main button pulls the shot, the glass fills, and the game opens. Played glasses stay full on the counter with the result under them.
- The espresso machine is dead centre; the six glasses sit in a row in front of it. All important things stay in the middle so any screen shape can crop the edges.
- Cat: Siamese, asleep on the windowsill (not on the counter). Dog: white Maltese by the door. Queue on the right, regulars' table on the left.
- Web app on every screen: the café picture keeps one shape and is centred; phones get the button below it, landscape and desktop get it beside it.
- Scale rule (Job, 2026-11-14): everything is sized by height against the door, so people, animals and the machine share one scale. In the tall (phone) room there is no floor, so customers stand behind the counter and a counter layer hides their legs. The glasses guy and long-hair girl (art/sprites/m-*.png) are the two main customers at the front of the queue; the other people are background regulars walking past. Live mockup: design/cafe/5-cafe.html.
