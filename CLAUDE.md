# Daily Dose: notes for Claude

A daily games hub (NYT Games style): one home screen, a new puzzle in each game every day, the same for everyone, reset at 00:00 UTC. Owner: **Job** (not a professional developer: plain, short explanations; result first).

- Live beta: https://daily-dose-azure.vercel.app. Vercel project `daily-dose` deploys every push to `claude/vault-supabase` (the repo's only branch, so it is production). **Ask Job before pushing.**
- Repo: github.com/jedidiah5K/DailyDose (private).
- Full brief: Job's build prompt (lineup, rules, Pro, security checklist). Built: Rewire, Hunch, Drop, Mind Meld (world mode), Last Stand (daily, Job's call on 2026-10-26), You screen (stats + badges), Friends (typed friend codes, Job's call: no invite links). Not yet: Mind Meld duo mode, World Tower, Drop ghost replays, admin page, notifications. Later drops: Bluff, Zoom, Echo.

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
src/screens/hub.js       home: GAMES list (add new games here), countdown, streak, share
src/screens/rewire.js    Rewire play/solve/result     src/games/rewireLogic.js  generator + uniqueness solver
src/screens/hunch.js     Hunch slider/reveal/summary  content/hunch.json         questions (with sources)
src/screens/drop.js      Drop canvas course           src/games/dropLogic.js    physics (copied to supabase/functions/dose-drop; a test checks they match)
src/screens/meld.js      Mind Meld world mode         content/meld.json         prompts + accepted answers
src/screens/last.js      Last Stand + dot field       src/games/lastLogic.js    round maker (no facts: numbers, shapes, word groups)
src/lib/cloud.js         Supabase calls               src/lib/store.js          local state ('dose:v1'), streaks, mergeResults
src/screens/me.js        You: name, account, stats    src/lib/badges.js         badges, worked out from results (nothing stored)
src/screens/friends.js   friend codes, friends list, friends on result screens and the home row
src/ui/card.js           LINEUP: each game's name, colour and result line (share card, friends, stats)
tools/*-gen.mjs          make Rewire / Drop / Last Stand content as SQL (random secret per run; output *.local.sql is gitignored)
```

## Content
- `dose_puzzles` (game, day, content). No client access; only the `dose_<game>_start` functions hand out today's puzzle.
- Loaded to: Rewire 23 Dec, Drop 24 Dec, Last Stand 9 Dec, Hunch 10 Nov, Mind Meld 10 Nov. Hunch answers and Mind Meld prompts need Job's review. Check end dates often: a game with no puzzle says "not ready yet". Mind Meld: add days to content/meld.json, then `node tools/meld-sql.mjs <from-date>` checks and builds the SQL.
- Drop runs in the Edge Function `dose-drop` (replays shots server-side). Everything else is Postgres functions `dose_<game>_*`.

## Commands
```
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```
