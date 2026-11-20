# The nightly dive (plan for Job, 2026-11-20)

Krillion's hook, café version: every game you play sinks you deeper into tonight's cup of coffee, past fun
landmarks, and nobody leaves with nothing. Six games, one journey you can see.

## The idea in one line
Each finished game turns into **metres of depth** (0 to 100 m per game, 600 m for a perfect night). The home
screen shows how deep you are tonight; every game you finish drops you further down.

## What stays the same
- Every game keeps its rules, its own score, its result screen and its share line.
- Rankings and "better than X%" stay exactly as they are (server-measured).
- The dive is worked out on the phone from results the server already sends. No database change in phase 1,
  and past nights convert too (your streak history gets depths straight away).

## How each game turns into depth (0 to 100 m)
| Game | Depth | Why it feels fair |
|---|---|---|
| The Shot | Got it: 60 m + up to 40 m for speed. So close: 30 m. Missed: 10 m | Even a miss sinks you a little |
| Rush | 5 m per point, up to 100 m | Every answer counts, rare ones more (already Krillion-like) |
| Blend | score ÷ 5 (500 points = 100 m) | Already partial |
| Drop | Banked: 30 m + up to 70 m for how far up the chain. Bust: 5 m per right call, up to 30 m | Busting still counts, banking counts more |
| Missing Link | score ÷ 15 × 100 (each solved link counts) | Leaving early still keeps what you solved |
| Ladder | Solved at par: 100 m, −10 m per extra step (never under 50 m). Gave up: 15 m | Phase 2 adds "how close you got" |

The numbers are a first guess. I'll tune them on real nights so an average night lands around 300 m.

## Landmarks on the way down (examples, Job to edit)
0 m the foam · 40 m latte-art heart · 90 m the crema line · 150 m a sugar cube dissolving · 220 m a lost
teaspoon · 300 m a coffee bean submarine · 380 m the barista's wedding ring · 450 m a tiny shipwreck of biscotti ·
520 m the cat's missing toy · 600 m the bottom of the cup (a perfect dose).

## Where you see it
1. **Home:** a depth gauge down the side of the cup/counter with your metres tonight. Back from a game, the
   number rolls down and the landmark you passed pops up ("You sank past the crema line!").
2. **Result screens:** one line under the score: "+72 m · 214 m deep tonight".
3. **Dose complete:** the big moment shows your final depth and deepest landmark.
4. **Share card and text:** "☕ 412 m deep, past the barista's wedding ring".
5. **Friends:** "You sank deeper than 3 friends tonight" (from results friends already share).

## Phase 2 (later, needs small server changes)
- Ladder remembers your closest word, so giving up still pays for how near you got.
- Live "1,204 playing tonight" on home (already built, hidden under 25 players).
- Yesterday's dive (archive) and themed event weeks.

## Build order (phase 1)
1. `depth(game, result)` + landmarks in `src/ui/card.js`, with a test for each game.
2. Result-screen line (shared helper next to `resultButtons`).
3. Home gauge + "sank past" pop-up + Dose complete depth.
4. Share card/text line, Friends line.
5. Check on phone upright/sideways, then push.

## Decisions for Job
- Units: metres (like Krillion) or something cosier ("sips", "spoons deep")?
- The landmark list: keep, edit, or let me write a funnier set?
- Show the depth gauge on home all the time, or only after your first game of the night?
