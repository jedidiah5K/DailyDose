-- Daily Dose, setup 21: Anagram near-miss. A wrong word now says how many letters are already in the right
-- spot ('not it:3'), so players feel how close they are. Same function as setup 18 otherwise. Safe to run twice.

create or replace function public.dose_anagram_guess(p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; g jsonb; k int; n int; w text; target text; res jsonb; ms int; solved int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'anagram' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'anagram' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_anagram_state(c, play); end if;
  g := coalesce(play.guesses, '[]'); k := jsonb_array_length(g); n := jsonb_array_length(c->'words');
  target := c->'words'->>k;
  w := case when trim(coalesce(p_guess, '')) = '?' then '?' else regexp_replace(lower(coalesce(p_guess, '')), '[^a-z]', '', 'g') end;
  if w = '?' then g := g || '["skip"]';
  elsif w = target or coalesce(c->'also'->k, '[]') ? w then g := g || '["ok"]';
  else raise exception 'not it:%', (select count(*) from generate_series(1, least(length(w), length(target))) i where substr(w, i, 1) = substr(target, i, 1)) using errcode = '22023';
  end if;
  if jsonb_array_length(g) = n then
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    solved := (select count(*) from jsonb_array_elements_text(g) o where o = 'ok');
    select count(*) filter (where (result->>'solved')::int < solved or ((result->>'solved')::int = solved and (result->>'ms')::int > ms)), count(*)
      into better, total from public.dose_plays where game = 'anagram' and day = today and finished_at is not null;
    res := jsonb_build_object('solved', solved, 'n', n, 'ms', ms, 'words', c->'words',
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  end if;
  update public.dose_plays set guesses = g, result = res, finished_at = case when res is not null then now() end, won = case when res is not null then solved = n end
    where user_id = uid and game = 'anagram' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'anagram' and day = today;
  return public.dose_anagram_state(c, play);
end $$;
