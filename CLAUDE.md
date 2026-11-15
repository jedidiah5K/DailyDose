# Daily Dose: notes for Claude

A daily games hub (NYT Games style): one home screen, a new puzzle in each game every day, reset at 00:00 in the player's own time zone (the app sends `x-dose-tz`; the server works out "today" in `dose_today()`). Owner: **Job** (not a professional developer: plain, short explanations; result first).

- Live beta: https://daily-dose-azure.vercel.app. Vercel project `daily-dose` deploys every push to `claude/vault-supabase` (the repo's only branch, so it is production). **Ask Job before pushing.**
- Repo: github.com/jedidiah5K/DailyDose (private).
- Full brief: Job's build prompt (lineup, rules, Pro, security checklist). Lineup (Job, 2026-11-14), in home order: The Shot (1 question, 7 s), Rush (30 s typing), Blend, Drop (higher/lower, pot doubles, bank or bust; key 'hilo' because 'drop' is the retired game), Missing Link, Ladder. Screens are plain for now: the coffee-shop look is being designed in another conversation. Each game should give a different feeling (mind-reading, panic, snap, nerve, aha, calm). Benched: Hunch. Retired: Rewire, Tangle, Anagram, old Drop, Mind Meld, Last Stand, Cipher (code and old results stay). Also built: You screen (stats + badges), Friends (typed friend codes, no invite links). Not yet: World Tower, admin page, notifications. Later drops: Bluff, Zoom, Echo.
- Look now (Job, 2026-11-15): a pixel-art café. Home = the barista's pick-up window (`src/screens/hub.js`, art in `public/art/home/`, layout in the picture's own pixels, tall and wide, day and night by clock): pick a mug, Pull, the shot pours and you dive into the game. Each game sits in its own backdrop with cream signboard cards and the golden pill button (`src/ui/cafe.css`, `src/ui/home.css`). One font everywhere: Pixelify Sans. Art comes from ChatGPT sheets on magenta, cut with `tools/slice-magenta.py`; mockups and raw art stay in `design/cafe/` (not in git).
- Old look (Job's calls, 2026-10-26, replaced): home is the day's newspaper, "The Daily Dose": masthead, a top story (next game, big Play, faded "up for grabs" sticker), a 2-column grid with one story per game. **A story is only the game's name, big serif** — Job cut the descriptive joke lines and the dek the same night, and asked for the names enlarged to fill the space they left. Solving a game slaps its sticker on its story (worn, squiggly-edged square in the game colour, `src/ui/stickers.js`). All six = "EXTRA! EXTRA!" box + Sticker Bomb share card (dark card, sticker pile, the streak as a small line under the date; `src/ui/card.js`). Floating tab bar (Today, Friends, You). Instrument Serif headlines, Geist body, Geist Mono labels. Each game: shared header + How to play pop-up (`src/ui/shell.js`). Rejected so far: neon night city, plain NYT copy, big colour tiles, sky+moon home, retro stickers, per-game joke headlines on home. Design concepts live on a private canvas (claude.ai/artifact/535JyRRVgKcSJUhSMf5RjA).

## Difficulty rule for every game (Job, 2026-10-26)
Hard enough that people get annoyed they can't solve it, but keep wanting more. Every game needs:
- **Near-miss feedback** that shows how close you were (lit buildings, crossings left, letters in the right spot, first-letter hint, % off), so a miss feels like "I see it now", never "the game is broken".
- **An "aha"**: simple rules, dense solution space; brute force should stall (Missing Link mixes answer-before and answer-after clues).
- **Unfinished tension**: a started-but-unfinished game shows a half-full circle on home ("pick it back up"); the moon isn't full until everything is done.
- **Zero-friction retry**: undo, skip-and-come-back, no long animations or resets between tries.
Tuning so far: Rewire boards 4-6 wide, 3 stars within 25% of par; Tangle 8-11 dots, about 1.75 strings per dot.

## Ground rules
- Ask first: spending money, publishing, renaming, changing game rules or free vs Pro, touching KeepUp/JobDone/Petal data.
- Email + password only, no magic links, no email confirmation. Guests play via Supabase anonymous sign-in and can add an email/password later (same user id).
- Answers and solutions never reach the browser before the player answers: games are checked in Postgres functions (`security definer`).
- Rankings use only what the server measures (time, server-replayed shots). Rewire taps are counted on the phone: they set your stars, never your rank.
- Friends see each other's name and tonight's results only (`dose_friends_today` strips answers and the Hunch theme). Names go through `dose_set_name` (1-20 chars, no HTML/invisible chars) and are escaped in the app. Friend-code tries: 10 an hour, logged in `dose_security_events` for a day.
- Tables are reached only through functions, plus reading your own finished plays (`myResults`). Helper functions are revoked from the app's roles. Run the Supabase security advisor after DDL.
- No secrets in git. The Supabase publishable key in `src/lib/cloud.js` is public by design.

## Stack
- Vanilla JS + Vite PWA (same as KeepUp). Fonts: Instrument Serif, Geist, Geist Mono. Sounds are synthesised (Web Audio) in `src/ui/feedback.js`.
- Supabase project **"JobDone"** (capital J, ref `xgmwqpasogwlvtjaapwo`), shared with KeepUp (`keepup_`) and Petal (`petal` schema). Every Daily Dose table/function starts with `dose_`.
- Migrations in `supabase/migrations/` (numbered, safe to run twice).

## Layout
```
src/main.js              hash router (#rewire, #me, #friends ...), history sync, new-badge banners
src/screens/hub.js       home: GAMES list (add new games here: key, name, colour, result line), the newspaper and stickers
src/screens/rewire.js    Rewire play/solve/result     src/games/rewireLogic.js  generator + uniqueness solver
src/screens/hunch.js     Hunch slider/reveal/summary  content/hunch.json         questions (with sources)
src/screens/tangle.js    Tangle: drag dots apart      src/games/tangleLogic.js  crossing check + knot maker (same rules in dose_tangle_bad)
src/screens/link.js      Missing Link: 3 clues, 1 word content/link.json         5 links a day (answers stay on the server)
src/screens/blend.js     Blend: 5 typed prompts, 20 s  content/blend.json        answer lists + guessed weights (tools/blend-gen.mjs)
src/screens/shot.js      The Shot: 1 question, 7 s     content/shot.json         (tools/daily-gen.mjs makes Shot, Rush, Drop)
src/screens/rush.js      Rush: 30 s, many answers      content/rush.json         borrows Blend's lists
src/screens/drop.js      Drop (key hilo): higher/lower content/drop.json         number pools; chains of 12
src/screens/anagram.js   Anagram: 5 words, short-long content/anagram.json      words; scrambles made by tools/words-gen.mjs
src/screens/ladder.js    Ladder: word to word         content/words4.txt        word list (also in dose_words)
src/lib/cloud.js         Supabase calls               src/lib/store.js          local state ('dose:v1'), streaks, mergeResults
src/screens/me.js        You: name, account, stats    src/lib/badges.js         badges, worked out from results (nothing stored)
src/screens/friends.js   friend codes, friends list, friends on result screens and the home row
src/ui/card.js           LINEUP: each game's name, colour and result line (share card, friends, stats)
tools/*-gen.mjs          make puzzle content as SQL (random secret per run; output *.local.sql is gitignored)
```

## Content
- `dose_puzzles` (game, day, content). No client access; only the `dose_<game>_start` functions hand out today's puzzle.
- Loaded to (checked 2026-11-14): Blend 21 Nov, Drop 22 Nov, Rush 23 Nov, The Shot 29 Nov, Ladder 9 Dec, Missing Link 24 Dec. Write more Blend, Drop, Rush and Shot days soon: they run out first. Load by pasting rows from the generators into SQL (one row per line). Hunch answers, Missing Link clues and Anagram words need Job's review (days added 2026-11-11 are in content/added-2026-11.json; older days recycled, Job OK'd). Check end dates often: a game with no puzzle says "not ready yet". Generators: tools/rewire-gen.mjs, tangle-gen.mjs, ladder-gen.mjs (content/words4.txt), words-gen.mjs (Missing Link + Anagram from content/*.json).
- Drop runs in the Edge Function `dose-drop` (replays shots server-side). Everything else is Postgres functions `dose_<game>_*`.

## Commands
```
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```
