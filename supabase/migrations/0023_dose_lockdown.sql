-- Audit 2026-11-01: lock server functions the app no longer calls. Retired games' results stay in dose_plays.
-- Safe to run twice.

-- Retired games: Cipher, Last Stand, Mind Meld.
revoke all on function public.dose_cipher_start() from public, anon, authenticated;
revoke all on function public.dose_cipher_guess(text, text) from public, anon, authenticated;
revoke all on function public.dose_last_start() from public, anon, authenticated;
revoke all on function public.dose_last_serve() from public, anon, authenticated;
revoke all on function public.dose_last_answer(integer) from public, anon, authenticated;
revoke all on function public.dose_last_bank() from public, anon, authenticated;
revoke all on function public.dose_last_pick(text) from public, anon, authenticated;
revoke all on function public.dose_last_use(text) from public, anon, authenticated;
revoke all on function public.dose_meld_start() from public, anon, authenticated;
revoke all on function public.dose_meld_serve() from public, anon, authenticated;
revoke all on function public.dose_meld_answer(text, text, boolean) from public, anon, authenticated;

-- Old Rewire submit without the tap count (the app sends taps).
revoke all on function public.dose_rewire_submit(smallint[]) from public, anon, authenticated;

-- Player count: every player has a (guest) session, so no need for signed-out access.
revoke all on function public.dose_players_today() from public, anon;
grant execute on function public.dose_players_today() to authenticated;
