# DESLOPIFY the DailyDose web game: make it feel hand-made, not AI-made

Instructions for the coding agent. Read the whole file first.

## How to work
1. **Audit first, change nothing.** Open the live site and `npm run dev`, play every game on phone width (375px) and desktop,
   in light and dark mode, at 200% browser zoom. Screenshot each screen.
2. **Report** every problem below that you find, grouped by section, with the file and a screenshot. Wait for Job's OK.
3. **Fix in small batches** (one section at a time), re-screenshot, compare before/after. Don't change game rules,
   difficulty or free vs Pro without asking (see CLAUDE.md).

## 1. Visual tells to remove
- Purple/blue gradients, glowing blobs, glassmorphism everywhere, "three rounded cards" layouts
- Pills/tags on everything, eyebrow labels over headings, "01 / 02" numbering, ALL-CAPS subtitles
- Every block in a bordered card; too many dividers; many shades of the same colour (one brand colour + neutrals)
- Sparkle/emoji icons as decoration, emojis inside buttons, generic stock icons (use one icon set, drawn or chosen on purpose)
- Default system font everywhere, or the trendy AI font of the month. Pick one display face for the newspaper masthead
  and one readable text face; self-host them (no Google Fonts CDN, GDPR)
- Text or tap targets too small (min 44px), floating elements scattered by too much padding

## 2. The game screens
- The board is the hero: biggest thing on screen, nothing competing with it
- One obvious main action per screen (Play / Submit / Next). Never two equally loud buttons
- Fitts's Law: main button big and near the bottom on phones; whole list rows tappable; destructive actions far from submit
- Keyboard/letter input works with both a physical keyboard and on-screen taps; nothing covered by the phone keyboard
- Near-miss feedback is clear and instant (per CLAUDE.md difficulty rule): show how close, never just "wrong"
- Result screen: score, near-miss, streak, share card. Next/Continue in the same spot every time

## 3. Behaviour tells (feels vibe-coded)
- Double tap submits twice → disable while pending
- Raw errors / "404" / stack traces on screen → friendly message with what to do next
- Spinners → skeleton of the board/home shaped like the real thing
- Home blocked on the network → show cached snapshot instantly, refresh in background
- White flash on load or theme switch → background colour set before first paint
- Text unreadable in dark mode; layout breaks at 200% zoom or large text settings
- Back button loses a half-played game → keep progress (and show the half-full circle on home)
- Taps give no feedback → visible pressed state; vibration on mobile for win/lose where supported
- Puzzle state lost after an update → persist and migrate saved progress

## 4. Motion (exact values)
- Entrances ease-out ~200 ms; exits ~20% shorter; popovers 150–250 ms from scale 0.95 out of the trigger
- Buttons/tiles scale to 0.97 on press; tile reveals stagger ~30 ms
- Scores and streak numbers roll instead of jumping
- One big celebration for the day's biggest moment (finishing every game / full moon), not confetti on every win
- Respect `prefers-reduced-motion`; no motion that blocks input

## 5. Copy
- Say it once, short. No "Unlock", "Elevate", "Seamless", "Supercharge", "🚀"
- Buttons say the outcome ("Check word", "Next puzzle"), not "Submit"
- Headlines say what you get today, not feature names
- Empty states invite the first action ("Today's puzzle is waiting")
- Run player-facing text through the humanizer skill

## 6. Personality (what makes it not generic)
- Lean into the newspaper: masthead, date line, section rules, small editorial jokes. Consistent, not decorative
- A small recurring character or illustration style on loading, empty and "come back tomorrow" screens
- Premium physical details where they matter: a tile that flips with weight, a stamp when the day is complete

## 7. Accessibility basics (never cut)
- Colour isn't the only signal for right/near/wrong (add icons or patterns); contrast passes WCAG AA
- Every control reachable by keyboard with a visible focus ring; screen-reader labels on icon buttons and tiles

## 8. Done means
- Before/after screenshots for every changed screen, phone + desktop, light + dark
- Lighthouse: performance and accessibility checked; no console errors
- `npm test` passes; Job approved each batch
- Skills to run at the end: impeccable (audit), make-interfaces-feel-better, break-ui (worst-case data), web-design-guidelines
