-- Daily Dose, setup 15: Tangle. Drag the dots until no lines cross. The server times it and checks the
-- final board with the same rules as src/games/tangleLogic.js. Safe to run twice.
-- content = {"n": 9, "edges": [[a, b], ...], "start": [[x, y], ...], "solution": [[x, y], ...]}

alter table public.dose_plays drop constraint if exists dose_plays_game_check;
alter table public.dose_plays add constraint dose_plays_game_check check (game in
  ('vault', 'rewire', 'hunch', 'drop', 'meld', 'last', 'tangle', 'cipher', 'ladder', 'bluff', 'zoom', 'echo'));

-- True when the board still has a problem: two lines crossing, a dot on a line it isn't part of
-- (closer than 0.02), or two dots on top of each other (closer than 0.04).
create or replace function public.dose_tangle_bad(p_pos jsonb, p_edges jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  n int := jsonb_array_length(p_pos); e int := jsonb_array_length(p_edges);
  x float8[] := array(select (v->>0)::float8 from jsonb_array_elements(p_pos) with ordinality t(v, o) order by o);
  y float8[] := array(select (v->>1)::float8 from jsonb_array_elements(p_pos) with ordinality t(v, o) order by o);
  ea int[] := array(select (v->>0)::int + 1 from jsonb_array_elements(p_edges) with ordinality t(v, o) order by o);
  eb int[] := array(select (v->>1)::int + 1 from jsonb_array_elements(p_edges) with ordinality t(v, o) order by o);
  i int; j int; k int; a int; b int; c int; d int; dx float8; dy float8; len2 float8; t float8;
begin
  for i in 1..e loop
    a := ea[i]; b := eb[i];
    for j in i + 1..e loop
      c := ea[j]; d := eb[j];
      continue when a in (c, d) or b in (c, d);
      if ((x[d]-x[c])*(y[a]-y[c]) - (y[d]-y[c])*(x[a]-x[c])) * ((x[d]-x[c])*(y[b]-y[c]) - (y[d]-y[c])*(x[b]-x[c])) < 0
         and ((x[b]-x[a])*(y[c]-y[a]) - (y[b]-y[a])*(x[c]-x[a])) * ((x[b]-x[a])*(y[d]-y[a]) - (y[b]-y[a])*(x[d]-x[a])) < 0 then
        return true;
      end if;
    end loop;
    dx := x[b] - x[a]; dy := y[b] - y[a]; len2 := dx * dx + dy * dy;
    for k in 1..n loop
      continue when k in (a, b);
      t := case when len2 > 0 then greatest(0, least(1, ((x[k]-x[a]) * dx + (y[k]-y[a]) * dy) / len2)) else 0 end;
      if sqrt((x[k]-x[a]-t*dx)^2 + (y[k]-y[a]-t*dy)^2) < 0.02 then return true; end if;
    end loop;
  end loop;
  for i in 1..n loop
    for j in i + 1..n loop
      if sqrt((x[i]-x[j])^2 + (y[i]-y[j])^2) < 0.04 then return true; end if;
    end loop;
  end loop;
  return false;
end $$;
revoke all on function public.dose_tangle_bad(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.dose_tangle_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'tangle' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'tangle', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'tangle' and day = today;
  return jsonb_build_object('n', c->'n', 'edges', c->'edges', 'start', c->'start',
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result);
end $$;

-- Finish: the board must be untangled. Ranked by the server's time; moves are counted on the phone
-- and only shown, never ranked.
create or replace function public.dose_tangle_submit(p_pos jsonb, p_moves int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; ms int; better int; total int; res jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'tangle' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'tangle' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return play.result; end if;
  if jsonb_typeof(p_pos) <> 'array' or jsonb_array_length(p_pos) <> (c->>'n')::int
     or exists (select 1 from jsonb_array_elements(p_pos) v where jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> 2
                or jsonb_typeof(v->0) <> 'number' or jsonb_typeof(v->1) <> 'number'
                or (v->>0)::float8 not between 0 and 1 or (v->>1)::float8 not between 0 and 1) then
    raise exception 'bad board' using errcode = '22023';
  end if;
  if public.dose_tangle_bad(p_pos, c->'edges') then raise exception 'not solved' using errcode = 'P0001'; end if;
  ms := floor(extract(epoch from now() - play.started_at) * 1000);
  select count(*) filter (where (result->>'ms')::int > ms), count(*) into better, total
    from public.dose_plays where game = 'tangle' and day = today and finished_at is not null;
  res := jsonb_build_object('ms', ms, 'moves', greatest(coalesce(p_moves, 0), 0),
    'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  update public.dose_plays set won = true, finished_at = now(), result = res, guesses = p_pos
    where user_id = uid and game = 'tangle' and day = today;
  return res;
end $$;

revoke all on function public.dose_tangle_start() from public, anon;
revoke all on function public.dose_tangle_submit(jsonb, int) from public, anon;
grant execute on function public.dose_tangle_start() to authenticated;
grant execute on function public.dose_tangle_submit(jsonb, int) to authenticated;
