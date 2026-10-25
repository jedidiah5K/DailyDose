-- Daily Dose, setup 5: Rewire hints (each one costs 30 seconds). Safe to run twice.

create or replace function public.dose_rewire_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rewire' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'rewire', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'rewire' and day = today;
  return jsonb_build_object('w', c->'w', 'plant', c->'plant', 'tiles', c->'tiles', 'buildings', c->'buildings',
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result,
    'hints', (select coalesce(jsonb_agg(jsonb_build_object('i', h::int, 'm', c->'solution'->(h::int))), '[]') from jsonb_array_elements_text(play.guesses) h));
end $$;
revoke all on function public.dose_rewire_start() from public, anon;
grant execute on function public.dose_rewire_start() to authenticated;

-- A hint: the server sets one wrong tile to its right facing and locks it. Costs 30 seconds.
-- The hinted tiles are kept in dose_plays.guesses for Rewire.
create or replace function public.dose_rewire_hint(p_tiles smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; pick int; n int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rewire' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'rewire' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  n := (c->>'w')::int ^ 2;
  if cardinality(p_tiles) is distinct from n then raise exception 'bad grid' using errcode = '22023'; end if;
  select i into pick from generate_series(0, n - 1) i
    where p_tiles[i + 1] <> (c->'solution'->>i)::int and not play.guesses @> to_jsonb(i)
    order by random() limit 1;
  if pick is null then return null; end if;
  update public.dose_plays set guesses = guesses || to_jsonb(pick) where user_id = uid and game = 'rewire' and day = today;
  return jsonb_build_object('i', pick, 'm', (c->'solution'->>pick)::int);
end $$;
revoke all on function public.dose_rewire_hint(smallint[]) from public, anon;
grant execute on function public.dose_rewire_hint(smallint[]) to authenticated;

create or replace function public.dose_rewire_submit(p_tiles smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays;
  w int; n int; plant int; orig int[];
  i int; j int; k int; m int; x int; y int; ok boolean; edges int := 0;
  q int[]; seen boolean[]; reached int := 1;
  ms int; faster int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rewire' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'rewire' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return play.result; end if;

  w := (c->>'w')::int; n := w * w; plant := (c->>'plant')::int;
  orig := array(select t::int from jsonb_array_elements_text(c->'tiles') with ordinality as e(t, o) order by o);
  if cardinality(p_tiles) is distinct from n then raise exception 'bad grid' using errcode = '22023'; end if;

  -- arrays here are 1-based; cell i (0-based) lives at [i + 1]
  for i in 0..n - 1 loop
    m := p_tiles[i + 1]; ok := false;
    for k in 0..3 loop
      if m = (((orig[i + 1] << k) | (orig[i + 1] >> (4 - k))) & 15) then ok := true; end if;
    end loop;
    if not ok then raise exception 'bad grid' using errcode = '22023'; end if;
    x := i % w; y := i / w;
    if (m & 1 > 0 and (y = 0 or p_tiles[i - w + 1] & 4 = 0))
      or (m & 2 > 0 and (x = w - 1 or p_tiles[i + 2] & 8 = 0))
      or (m & 4 > 0 and (y = w - 1 or p_tiles[i + w + 1] & 1 = 0))
      or (m & 8 > 0 and (x = 0 or p_tiles[i] & 2 = 0)) then
      raise exception 'not solved' using errcode = 'P0001';
    end if;
    if m & 2 > 0 then edges := edges + 1; end if;
    if m & 4 > 0 then edges := edges + 1; end if;
  end loop;

  seen := array_fill(false, array[n]); seen[plant + 1] := true; q := array[plant];
  while cardinality(q) > 0 loop
    i := q[1]; q := q[2:]; m := p_tiles[i + 1];
    foreach j in array array[
      case when m & 1 > 0 then i - w end, case when m & 2 > 0 then i + 1 end,
      case when m & 4 > 0 then i + w end, case when m & 8 > 0 then i - 1 end] loop
      if j is not null and not seen[j + 1] then seen[j + 1] := true; reached := reached + 1; q := q || j; end if;
    end loop;
  end loop;
  if reached <> n or edges <> n - 1 then raise exception 'not solved' using errcode = 'P0001'; end if;

  -- every hint adds 30 seconds
  ms := floor(extract(epoch from now() - play.started_at) * 1000) + 30000 * jsonb_array_length(play.guesses);
  select count(*) filter (where (result->>'ms')::int < ms), count(*) into faster, total
    from public.dose_plays where game = 'rewire' and day = today and finished_at is not null;
  update public.dose_plays set won = true, finished_at = now(),
    result = jsonb_build_object('ms', ms, 'hints', jsonb_array_length(play.guesses), 'beat', case when total > 0 then round(100.0 * (total - faster) / (total + 1)) end, 'players', total + 1)
  where user_id = uid and game = 'rewire' and day = today
  returning result into c;
  return c;
end $$;
revoke all on function public.dose_rewire_submit(smallint[]) from public, anon;
grant execute on function public.dose_rewire_submit(smallint[]) to authenticated;
