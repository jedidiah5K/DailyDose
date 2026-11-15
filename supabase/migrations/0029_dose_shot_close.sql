-- The Shot: a near miss says "So close!" instead of just "Missed" (Job, 2026-11-15).
-- Close = a few letters off (more than the typo allowance) or a number within 3 (within 5% only for numbers over 3,000, so years stay tight).
create or replace function public.dose_shot_near(answer text, typed text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when answer ~ '^[0-9]+$' and replace(typed, ' ', '') ~ '^[0-9]{1,9}$'
      then abs(answer::numeric - replace(typed, ' ', '')::numeric) <= case when answer::numeric > 3000 then answer::numeric * 0.05 else 3 end
    when answer !~ '[0-9]' and length(replace(answer, ' ', '')) >= 4
      then extensions.levenshtein(replace(answer, ' ', ''), replace(typed, ' ', '')) <= greatest(2, length(replace(answer, ' ', '')) / 3)
    else false end
$$;
revoke all on function public.dose_shot_near(text, text) from public, anon, authenticated;

create or replace function public.dose_shot_answer(p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
  w text := public.dose_shot_clean(p_text); el numeric; ok boolean; close boolean; got int; tot int; slower int; quick int; res jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'shot' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'shot' and day = today for update;
  if c is null or play.user_id is null or jsonb_typeof(play.guesses) <> 'object' then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_shot_state(c, play); end if;
  el := public.dose_ms_since(play.guesses->'o');
  ok := el <= 9000 and w <> '' and exists (select 1 from jsonb_array_elements_text(c->'a') x
          where replace(x, ' ', '') in (replace(w, ' ', ''), regexp_replace(replace(w, ' ', ''), 's$', ''))
             or public.dose_typo_ok(x, w));
  close := not ok and w <> '' and exists (select 1 from jsonb_array_elements_text(c->'a') x where public.dose_shot_near(x, w));
  select count(*) filter (where (result->>'ok')::boolean), count(*),
         count(*) filter (where (result->>'ok')::boolean and (result->>'ms')::int > least(el, 7000))
    into got, tot, slower from public.dose_plays where game = 'shot' and day = today and finished_at is not null;
  quick := least(el, 7000)::int;
  res := jsonb_build_object('ok', ok, 'ms', quick, 'answer', c->'show',
    'pct', round(100.0 * (got + ok::int) / (tot + 1)), 'players', tot + 1,
    'beat', case when ok and got > 0 then round(100.0 * slower / got) end)
    || case when close then '{"close": true}'::jsonb else '{}'::jsonb end;
  update public.dose_plays set guesses = play.guesses || jsonb_build_object('r', left(w, 30)), result = res, finished_at = now(), won = ok
    where user_id = uid and game = 'shot' and day = today returning * into play;
  return public.dose_shot_state(c, play);
end $$;
