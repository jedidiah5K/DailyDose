# Daily Dose: notes for Claude

A daily games hub (NYT Games style): one home screen, a new puzzle in each game every day, the same for everyone, reset at 00:00 UTC. Owner: **Job** (not a professional developer: plain, short explanations; result first).

- Live beta: https://daily-dose-azure.vercel.app. Vercel project `daily-dose` deploys every push to `claude/vault-supabase` (the repo's only branch, so it is production). **Ask Job before pushing.**
- Repo: github.com/jedidiah5K/DailyDose (private).
- Full brief: Job's build prompt (lineup, rules, Pro, security checklist). Lineup (6): Rewire, Hunch, Missing Link, Tangle, Anagram, Ladder. Retired: Drop, Mind Meld, Last Stand, Cipher (old results stay in dose_plays). Also built: You screen (stats + badges), Friends (typed friend codes, no invite links). Not yet: World Tower, admin page, notifications. Later drops: Bluff, Zoom, Echo.
- Look (Job's call 2026-10-26, from his KeepUp screenshots): warm paper, home hero = sky by time of day with a moon that fills as you finish games (full moon = all done), week strip of moons, game rows with a circle that fills, floating dark tab bar (Today, Friends, You) + accent play button. Instrument Serif headlines, Geist body, Geist Mono labels. Each game: shared header + How to play pop-up (`src/ui/shell.js`). He rejected: neon night city, plain NYT copy, big colour tiles.

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
src/screens/hub.js       home: GAMES list (add new games here), sky + moon hero, week strip, rows
src/screens/rewire.js    Rewire play/solve/result     src/games/rewireLogic.js  generator + uniqueness solver
src/screens/hunch.js     Hunch slider/reveal/summary  content/hunch.json         questions (with sources)
src/screens/tangle.js    Tangle: drag dots apart      src/games/tangleLogic.js  crossing check + knot maker (same rules in dose_tangle_bad)
src/screens/link.js      Missing Link: 3 clues, 1 word content/link.json         5 links a day (answers stay on the server)
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
- Loaded to: Rewire 23 Dec, Tangle 24 Dec, Ladder 9 Dec, Hunch 10 Nov, Missing Link 8 Nov, Anagram 8 Nov. Hunch answers, Missing Link clues and Anagram words need Job's review. Check end dates often: a game with no puzzle says "not ready yet". Generators: tools/rewire-gen.mjs, tangle-gen.mjs, ladder-gen.mjs (content/words4.txt), words-gen.mjs (Missing Link + Anagram from content/*.json).
- Drop runs in the Edge Function `dose-drop` (replays shots server-side). Everything else is Postgres functions `dose_<game>_*`.

## Commands
```
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```
