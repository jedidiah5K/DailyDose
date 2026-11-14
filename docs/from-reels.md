# DailyDose: ideas worth applying (from Job's saved reels, Nov 2026)

Filtered for a daily web games hub (vanilla JS + Vite, Supabase, Vercel). Each item is a suggestion, not a decision.
Per CLAUDE.md, ask Job before changing game rules, free vs Pro, or anything that spends money or publishes.
Full source notes: `~/.claude/brain/` (ux-conversion, growth-launch, video-marketing, security).

## 1. First visit → hooked (onboarding)
- [ ] A new visitor plays today's first puzzle within 30 seconds, with no signup and no tutorial wall. Teach by playing.
- [ ] Ask for an account only after the first win ("Save your streak?"), never before playing. Sunk cost does the work.
- [ ] Open with the feeling, not features: the masthead line should say what you get today, not list games.
- [ ] Optional 2–3 questions (which game types, how much time a day) → "Your Daily Dose" order on home. Personal = sticky.
- [ ] Continue/Next buttons sit in the same spot on every intro or result screen.
- [ ] Borrow from the best: Duolingo (first-run, streaks), NYT Games (home as newspaper), Linear (UI calm).

## 2. Keeping players
- [ ] Streak protection and shared streaks with friends (invites = another reason to come back; Locket grew this way).
- [ ] Shareable result card after each game (emoji grid / near-miss score) that links back to the day's puzzle.
- [ ] A human answers every feedback message, ideally Job. Players notice.
- [ ] Reminder notification/email at the player's usual time, only if they opt in.
- [ ] No dark patterns: easy unsubscribe, easy cancel. Trust is the product for a daily habit.

## 3. If/when there's a Pro tier
- [ ] Trial timeline on the paywall: "Today: everything unlocked · Day 5: we remind you · Day 7: you're charged". Send the reminder. (Blinkist: +23% trial starts, −55% complaints.)
- [ ] Plain words win A/B tests: "1 month" not "30 days", "Pro" not a cute name, headline says what you get.
- [ ] One recommended plan, real price after trial, cancel steps next to the button.
- [ ] Never "price drops the longer you stay / resets if you cancel" (scary cancel = FTC click-to-cancel risk).

## 4. Getting players ($0 channels)
- [ ] Launch order: r/SideProject, Hacker News (Show HN), Product Hunt (Tue–Thu), Indie Hackers, Uneed. Puzzle subs too (r/WordGames, r/puzzles) asking for feedback, not pitching.
- [ ] List on AlternativeTo / SaaSHub as an alternative to NYT Games / Wordle; AI search reads those pages.
- [ ] SEO pages per game answering what people search ("daily word puzzle like Wordle", "today's [game] hint").
- [ ] Claude builds a list of puzzle/newsletter creators; Job messages them asking for feedback (some will share).
- [ ] Referral built into sharing (result card → friend lands on that puzzle → asked to save streak).

## 5. Short-form video for DailyDose
- [ ] Hook = context + curiosity + twist: "Only 3% solved today's puzzle in under a minute. Here's the trick." Never open with "today we're gonna…".
- [ ] Formats: "can you solve this in 10 seconds?" (viewer plays along), near-miss fails, friend vs friend race, tier list of daily games.
- [ ] Find small puzzle accounts that keep going viral (format carries it), copy the format with DailyDose puzzles.
- [ ] Post daily across TikTok, Reels, Shorts; end with "today's puzzle is live, link in bio".
- [ ] Installed skills that help: kinetic-typography, chart-animation, explainer-video, remotion-*, claude-shorts.

## 6. Security before more players (Supabase + Vercel)
- [ ] Network tab + view-source: search `sk-`, `service_role`. Nothing secret in the bundle.
- [ ] RLS on every table, tested from a second account (can player B read player A's streaks/friends?).
- [ ] User ID from the Supabase session server-side, never from the request body (scores, streaks, badges).
- [ ] Server-side score validation so leaderboards can't be faked from the console.
- [ ] Rate-limit sign-up, login, score submit and any AI endpoint; sign-out revokes the session.
- [ ] Scan git history for keys (trufflehog). Also check: no `.local.sql` dumps or `.git` served by Vercel.
- [ ] Error alerts (Sentry) and one tested restore from a Supabase backup.

## 7. Engineering at scale
- [ ] Daily puzzle fetch cached at the edge; home renders from a cached snapshot instantly, refreshes in background.
- [ ] Independent requests (puzzles, streaks, friends) in parallel, not one after another.
- [ ] Small admin panel: users (find/ban), feature flags with a kill switch per game, today's puzzle preview, feedback inbox.
- [ ] Load test the midnight reset (everyone in a time zone hits at once).
