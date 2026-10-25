-- Daily Dose, setup 8: Last Stand gets choices. Each round cleared is worth its round number in points.
-- Between rounds you can BANK (stop and keep everything) or push on; a wrong answer keeps only half.
-- After rounds 3 and 6 you pick a perk (hold up to 2): +5 seconds, 50/50, or skip a round. Safe to run twice.
--
-- While playing, dose_plays.result holds the run's state:
--   { "served": {"k", "at", "extra"}, "points", "perks": [...], "offer": [...] | null, "fifty": [i, j] }
-- When the run ends it becomes the final result: { "reached", "points", "banked", "perfect", "late", "beat", "players" }.

create or replace function public.dose_last_state(p public.dose_plays) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(case when p.finished_at is null then p.result end, '{}'::jsonb)
    || jsonb_build_object('points', coalesce((p.result->>'points')::int, 0), 'perks', coalesce(p.result->'perks', '[]'::jsonb));
$$;

-- Ends the run and works out how it compares with everyone else who finished today.
create or replace function public.dose_last_finish(uid uuid, today date, reached int, points int, banked boolean, perfect boolean, late boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb; lower int; total int;
begin
  select count(*) filter (where (result->>'points')::int < points), count(*) into lower, total
    from public.dose_plays where game = 'last' and day = today and finished_at is not null and user_id <> uid;
  res := jsonb_build_object('reached', reached, 'points', points, 'banked', banked, 'perfect', perfect, 'late', late,
    'beat', case when total > 0 then round(100.0 * lower / total) end, 'players', total + 1);
  update public.dose_plays set result = res, finished_at = now(), won = perfect or banked where user_id = uid and game = 'last' and day = today;
  return res;
end $$;
revoke all on function public.dose_last_finish(uuid, date, int, int, boolean, boolean, boolean) from public, anon, authenticated;

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
    'state', public.dose_last_state(play), 'result', case when play.finished_at is not null then play.result end);
end $$;

create or replace function public.dose_last_serve() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays; st jsonb; k int; r jsonb; lim numeric; left_ms int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'last' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  st := public.dose_last_state(play);
  if jsonb_typeof(st->'offer') = 'array' then raise exception 'pick a perk first' using errcode = 'P0001'; end if;
  k := jsonb_array_length(play.guesses); r := c->'rounds'->k;
  if st->'served'->>'k' is distinct from k::text then
    st := (st - 'fifty') || jsonb_build_object('served', jsonb_build_object('k', k, 'at', now(), 'extra', 0));
    update public.dose_plays set result = st where user_id = uid and game = 'last' and day = today;
  end if;
  lim := public.dose_last_limit(r, k) + (st->'served'->>'extra')::numeric;
  left_ms := greatest(0, lim * 1000 - floor(extract(epoch from now() - (st->'served'->>'at')::timestamptz) * 1000));
  return jsonb_build_object('k', k, 'round', r - 'answer', 'limit_ms', lim * 1000, 'left_ms', left_ms,
    'points', st->'points', 'perks', st->'perks', 'fifty', st->'fifty');
end $$;

-- After a round is cleared: offer perks after rounds 3 and 6, or finish after round 10.
create or replace function public.dose_last_after(uid uuid, today date, st jsonb, k int, rounds int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  st := st - 'served' - 'fifty';
  if k + 1 = rounds then
    res := public.dose_last_finish(uid, today, rounds, (st->>'points')::int, false, true, false);
    return jsonb_build_object('result', res);
  end if;
  if k + 1 in (3, 6) and jsonb_array_length(st->'perks') < 2 then st := st || '{"offer": ["time", "fifty", "skip"]}'::jsonb; end if;
  update public.dose_plays set result = st where user_id = uid and game = 'last' and day = today;
  return jsonb_build_object('state', st);
end $$;
revoke all on function public.dose_last_after(uuid, date, jsonb, int, int) from public, anon, authenticated;

create or replace function public.dose_last_answer(p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; st jsonb; k int; r jsonb; late boolean; ok boolean; pts int; started int; survived int; nxt jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'last' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  st := public.dose_last_state(play); k := jsonb_array_length(play.guesses);
  if st->'served'->>'k' is distinct from k::text then raise exception 'not served' using errcode = 'P0001'; end if;
  r := c->'rounds'->k;
  late := now() - (st->'served'->>'at')::timestamptz > make_interval(secs => public.dose_last_limit(r, k) + (st->'served'->>'extra')::numeric + 1.5);
  ok := not late and p_choice = (r->>'answer')::int;
  pts := case when ok then k + 1 else 0 end;
  st := jsonb_set(st, '{points}', to_jsonb((st->>'points')::int + pts));
  update public.dose_plays set guesses = guesses || jsonb_build_array(jsonb_build_object('k', k, 'c', p_choice, 'ok', ok, 'late', late, 'pts', pts))
    where user_id = uid and game = 'last' and day = today;

  select count(*), count(*) filter (where jsonb_array_length(guesses) > k and (guesses->k->>'ok')::boolean)
    into started, survived from public.dose_plays where game = 'last' and day = today;

  if not ok then
    -- a wrong answer keeps half of what you had
    nxt := jsonb_build_object('result', public.dose_last_finish(uid, today, k, ((st->>'points')::int) / 2, false, false, late));
  else
    nxt := public.dose_last_after(uid, today, st, k, jsonb_array_length(c->'rounds'));
  end if;
  return jsonb_build_object('k', k, 'ok', ok, 'late', late, 'pts', pts, 'answer', case when not ok then (r->>'answer')::int end,
    'alive', round(100.0 * survived / greatest(started, 1), 1), 'started', started) || nxt;
end $$;

-- Stop now and keep every point. Only between rounds.
create or replace function public.dose_last_bank() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; play public.dose_plays; st jsonb; k int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  st := public.dose_last_state(play); k := jsonb_array_length(play.guesses);
  if st->'served'->>'k' = k::text then raise exception 'finish this round first' using errcode = 'P0001'; end if;
  if k = 0 then raise exception 'nothing to bank yet' using errcode = 'P0001'; end if;
  return jsonb_build_object('result', public.dose_last_finish(uid, today, k, (st->>'points')::int, true, false, false));
end $$;

-- Take one of the offered perks.
create or replace function public.dose_last_pick(p_perk text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; play public.dose_plays; st jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if play.user_id is null or play.finished_at is not null then raise exception 'not playing' using errcode = 'P0001'; end if;
  st := public.dose_last_state(play);
  if jsonb_typeof(st->'offer') <> 'array' or not (st->'offer' ? p_perk) then raise exception 'no such perk on offer' using errcode = '22023'; end if;
  st := (st - 'offer') || jsonb_build_object('perks', (st->'perks') || to_jsonb(p_perk));
  update public.dose_plays set result = st where user_id = uid and game = 'last' and day = today;
  return jsonb_build_object('state', st);
end $$;

-- Use a perk during the current round: time (+5s), fifty (two wrong choices removed), skip (cleared, no points).
create or replace function public.dose_last_use(p_perk text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays; st jsonb; k int; r jsonb; idx int; perks jsonb; wrong int[];
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'last' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'last' and day = today for update;
  if c is null or play.user_id is null or play.finished_at is not null then raise exception 'not playing' using errcode = 'P0001'; end if;
  st := public.dose_last_state(play); k := jsonb_array_length(play.guesses); r := c->'rounds'->k;
  if st->'served'->>'k' is distinct from k::text then raise exception 'no round in play' using errcode = 'P0001'; end if;
  select min(o) - 1 into idx from jsonb_array_elements_text(st->'perks') with ordinality e(p, o) where p = p_perk;
  if idx is null then raise exception 'you don''t have that perk' using errcode = '22023'; end if;
  perks := (select coalesce(jsonb_agg(p order by o), '[]') from jsonb_array_elements(st->'perks') with ordinality e(p, o) where o - 1 <> idx);
  st := jsonb_set(st, '{perks}', perks);

  if p_perk = 'time' then
    st := jsonb_set(st, '{served,extra}', to_jsonb((st->'served'->>'extra')::numeric + 5));
  elsif p_perk = 'fifty' then
    if r->>'type' in ('spot', 'bigger') then raise exception 'not on this round' using errcode = '22023'; end if;
    wrong := array(select i - 1 from jsonb_array_elements(r->'options') with ordinality e(x, i) where i - 1 <> (r->>'answer')::int order by random() limit 2);
    st := st || jsonb_build_object('fifty', to_jsonb(wrong));
  elsif p_perk = 'skip' then
    update public.dose_plays set guesses = guesses || jsonb_build_array(jsonb_build_object('k', k, 'ok', true, 'skip', true, 'pts', 0))
      where user_id = uid and game = 'last' and day = today;
    return jsonb_build_object('skipped', true) || public.dose_last_after(uid, today, st, k, jsonb_array_length(c->'rounds'));
  end if;
  update public.dose_plays set result = st where user_id = uid and game = 'last' and day = today;
  return jsonb_build_object('state', st);
end $$;

revoke all on function public.dose_last_bank() from public, anon;
revoke all on function public.dose_last_pick(text) from public, anon;
revoke all on function public.dose_last_use(text) from public, anon;
grant execute on function public.dose_last_bank() to authenticated;
grant execute on function public.dose_last_pick(text) to authenticated;
grant execute on function public.dose_last_use(text) to authenticated;
