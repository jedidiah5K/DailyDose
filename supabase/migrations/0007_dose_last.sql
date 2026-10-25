-- Daily Dose, setup 7: Last Stand. Ten rounds a day, one mistake or timeout and you're out.
-- Rounds are served one at a time; answers and timers are checked here. Safe to run twice.
-- content = {"rounds":[{type, prompt, options, data, answer}, ...]}

create or replace function public.dose_last_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'last' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'last', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today;
  return jsonb_build_object('rounds', jsonb_array_length(c->'rounds'), 'guesses', play.guesses,
    'result', case when play.finished_at is not null then play.result end);
end $$;

-- seconds allowed for round k (0-based): 15 down to 8, plus watching time for the light pattern
create or replace function public.dose_last_limit(r jsonb, k int) returns numeric
language sql immutable set search_path = '' as $$
  select round(15 - (k * 7.0) / 9) + case when r->>'type' = 'echo' then jsonb_array_length(r->'data') * 0.6 + 0.6 else 0 end;
$$;

create or replace function public.dose_last_serve() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays; k int; r jsonb; lim numeric; left_ms int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'last' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  k := jsonb_array_length(play.guesses); r := c->'rounds'->k; lim := public.dose_last_limit(r, k);
  if play.result->'served'->>'k' is distinct from k::text then
    update public.dose_plays set result = jsonb_build_object('served', jsonb_build_object('k', k, 'at', now()))
    where user_id = uid and game = 'last' and day = today;
    left_ms := lim * 1000;
  else
    left_ms := greatest(0, lim * 1000 - floor(extract(epoch from now() - (play.result->'served'->>'at')::timestamptz) * 1000));
  end if;
  return jsonb_build_object('k', k, 'round', r - 'answer', 'limit_ms', lim * 1000, 'left_ms', left_ms);
end $$;

create or replace function public.dose_last_answer(p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; k int; r jsonb; late boolean; ok boolean; started int; survived int; res jsonb; lower int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'last' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  k := jsonb_array_length(play.guesses);
  if play.result->'served'->>'k' is distinct from k::text then raise exception 'not served' using errcode = 'P0001'; end if;
  r := c->'rounds'->k;
  late := now() - (play.result->'served'->>'at')::timestamptz > make_interval(secs => public.dose_last_limit(r, k) + 1.5);   -- 1.5s grace for slow networks
  ok := not late and p_choice = (r->>'answer')::int;

  update public.dose_plays set guesses = guesses || jsonb_build_array(jsonb_build_object('k', k, 'c', p_choice, 'ok', ok, 'late', late)),
    result = '{}'::jsonb
  where user_id = uid and game = 'last' and day = today
  returning * into play;

  -- how much of today's field is still standing after this round (everyone who started counts)
  select count(*), count(*) filter (where jsonb_array_length(guesses) > k and (guesses->k->>'ok')::boolean)
    into started, survived from public.dose_plays where game = 'last' and day = today;

  if not ok or k + 1 = jsonb_array_length(c->'rounds') then
    -- reached = rounds survived; beat = share of other finished players who survived fewer
    select count(*) filter (where (result->>'reached')::int < case when ok then k + 1 else k end) into lower
      from public.dose_plays where game = 'last' and day = today and finished_at is not null and user_id <> uid;
    res := jsonb_build_object('reached', case when ok then k + 1 else k end, 'perfect', ok, 'late', late,
      'beat', case when started > 1 then round(100.0 * lower / (started - 1)) end, 'players', started);
    update public.dose_plays set result = res, finished_at = now(), won = ok where user_id = uid and game = 'last' and day = today;
  end if;
  return jsonb_build_object('k', k, 'ok', ok, 'late', late, 'answer', case when not ok then (r->>'answer')::int end,
    'alive', round(100.0 * survived / greatest(started, 1), 1), 'started', started, 'result', res);
end $$;

revoke all on function public.dose_last_start() from public, anon;
revoke all on function public.dose_last_serve() from public, anon;
revoke all on function public.dose_last_answer(int) from public, anon;
grant execute on function public.dose_last_start() to authenticated;
grant execute on function public.dose_last_serve() to authenticated;
grant execute on function public.dose_last_answer(int) to authenticated;
