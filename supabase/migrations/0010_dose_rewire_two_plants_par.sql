-- Daily Dose, setup 10: Rewire with two power plants (their networks must never touch) and par.
-- Taps only turn tiles clockwise; par is the fewest taps that solve it. 3 stars at par, 2 within 1.5x, else 1.
-- Old single-plant days (content.plant) keep working. Safe to run twice.

create or replace function public.dose_rewire_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rewire' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'rewire', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'rewire' and day = today;
  return jsonb_build_object('w', c->'w', 'plant', c->'plant', 'plants', coalesce(c->'plants', jsonb_build_array(c->'plant')),
    'tiles', c->'tiles', 'buildings', c->'buildings', 'par', c->'par',
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result,
    'hints', (select coalesce(jsonb_agg(jsonb_build_object('i', h::int, 'm', c->'solution'->(h::int))), '[]') from jsonb_array_elements_text(play.guesses) h));
end $$;

create or replace function public.dose_rewire_submit(p_tiles smallint[], p_taps int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays;
  w int; n int; orig int[]; plants int[]; owner int[];
  i int; j int; k int; m int; x int; y int; ok boolean; edges int := 0; p int;
  q int[]; reached int := 0;
  ms int; v_par int; taps int; stars int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rewire' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'rewire' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return play.result; end if;

  w := (c->>'w')::int; n := w * w;
  plants := array(select t::int from jsonb_array_elements_text(coalesce(c->'plants', jsonb_build_array(c->'plant'))) t);
  orig := array(select t::int from jsonb_array_elements_text(c->'tiles') with ordinality as e(t, o) order by o);
  if cardinality(p_tiles) is distinct from n then raise exception 'bad grid' using errcode = '22023'; end if;

  -- every tile only rotated, and no wire leads off the grid or into nothing (arrays are 1-based: cell i at [i + 1])
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

  -- each plant powers its own network; meeting the other plant's network means not solved
  owner := array_fill(-1, array[n]);
  for p in 1..cardinality(plants) loop
    if owner[plants[p] + 1] <> -1 then raise exception 'not solved' using errcode = 'P0001'; end if;
    owner[plants[p] + 1] := p; reached := reached + 1; q := array[plants[p]];
    while cardinality(q) > 0 loop
      i := q[1]; q := q[2:]; m := p_tiles[i + 1];
      foreach j in array array[
        case when m & 1 > 0 then i - w end, case when m & 2 > 0 then i + 1 end,
        case when m & 4 > 0 then i + w end, case when m & 8 > 0 then i - 1 end] loop
        if j is null then continue; end if;
        if owner[j + 1] = -1 then owner[j + 1] := p; reached := reached + 1; q := q || j;
        elsif owner[j + 1] <> p then raise exception 'not solved' using errcode = 'P0001';
        end if;
      end loop;
    end loop;
  end loop;
  if reached <> n or edges <> n - cardinality(plants) then raise exception 'not solved' using errcode = 'P0001'; end if;

  -- par from the stored solution; taps can't be fewer than par
  v_par := coalesce((c->>'par')::int, (select sum((select min(kk) from generate_series(0, 3) kk
      where (((orig[ii + 1] << kk) | (orig[ii + 1] >> (4 - kk))) & 15) = (c->'solution'->>ii)::int))::int
    from generate_series(0, n - 1) ii));
  taps := greatest(coalesce(p_taps, v_par), coalesce(v_par, 0));
  stars := case when v_par is null then null when taps <= v_par then 3 when taps <= v_par * 1.5 then 2 else 1 end;

  ms := floor(extract(epoch from now() - play.started_at) * 1000) + 30000 * jsonb_array_length(play.guesses);
  select count(*) filter (where coalesce((result->>'stars')::int, 0) < coalesce(stars, 0)
                             or (coalesce((result->>'stars')::int, 0) = coalesce(stars, 0) and (result->>'ms')::int > ms)), count(*)
    into better, total
    from public.dose_plays where game = 'rewire' and day = today and finished_at is not null;
  update public.dose_plays set won = true, finished_at = now(),
    result = jsonb_build_object('ms', ms, 'hints', jsonb_array_length(play.guesses), 'taps', taps, 'par', v_par, 'stars', stars,
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1)
  where user_id = uid and game = 'rewire' and day = today
  returning result into c;
  return c;
end $$;
revoke all on function public.dose_rewire_submit(smallint[], int) from public, anon;
grant execute on function public.dose_rewire_submit(smallint[], int) to authenticated;

-- the old one-argument version (apps from before this update) goes through the new checks
create or replace function public.dose_rewire_submit(p_tiles smallint[]) returns jsonb
language sql security definer set search_path = '' as $$ select public.dose_rewire_submit(p_tiles, null::int); $$;
