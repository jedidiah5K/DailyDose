-- Daily Dose, setup 22: the edition follows the player's time zone (Job, 2026-10-26).
-- The app sends IANA tz as header x-dose-tz and stores it on the profile. "Today" is that
-- calendar date, so the paper flips at local midnight. Rankings and friends-tonight are
-- per that local date. Safe to run twice.

alter table public.dose_profiles add column if not exists tz text;

create or replace function public.dose_tz_ok(p_tz text) returns text
language plpgsql stable set search_path = '' as $$
declare tz text := coalesce(nullif(trim(p_tz), ''), 'UTC');
begin
  if tz !~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$' then return 'UTC'; end if;
  perform timezone(tz, now());
  return tz;
exception when others then
  return 'UTC';
end $$;
revoke all on function public.dose_tz_ok(text) from public, anon, authenticated;

create or replace function public.dose_today() returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text;
  hdr json;
begin
  begin
    hdr := nullif(current_setting('request.headers', true), '')::json;
    tz := nullif(hdr->>'x-dose-tz', '');
  exception when others then
    tz := null;
  end;
  if tz is null then
    select p.tz into tz from public.dose_profiles p where p.id = auth.uid();
  end if;
  tz := public.dose_tz_ok(tz);
  return (timezone(tz, now()))::date;
end $$;
revoke all on function public.dose_today() from public, anon, authenticated;

create or replace function public.dose_set_tz(p_tz text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); tz text := public.dose_tz_ok(p_tz);
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.dose_profiles (id, tz) values (uid, tz)
    on conflict (id) do update set tz = excluded.tz;
  return tz;
end $$;
revoke all on function public.dose_set_tz(text) from public, anon;
grant execute on function public.dose_set_tz(text) to authenticated;

create or replace function public.dose_players_today() returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct user_id)::int from public.dose_plays where day = public.dose_today();
$$;

create or replace function public.dose_rewire_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
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

create or replace function public.dose_rewire_hint(p_tiles smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := public.dose_today();
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

create or replace function public.dose_rewire_submit(p_tiles smallint[], p_taps int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := public.dose_today();
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

  v_par := coalesce((c->>'par')::int, (select sum((select min(kk) from generate_series(0, 3) kk
      where (((orig[ii + 1] << kk) | (orig[ii + 1] >> (4 - kk))) & 15) = (c->'solution'->>ii)::int))::int
    from generate_series(0, n - 1) ii));
  taps := greatest(coalesce(p_taps, v_par), coalesce(v_par, 0));
  stars := case when v_par is null then null when taps <= ceil(v_par * 1.25) then 3 when taps <= v_par * 2 then 2 else 1 end;

  ms := floor(extract(epoch from now() - play.started_at) * 1000) + 30000 * jsonb_array_length(play.guesses);
  select count(*) filter (where (result->>'ms')::int > ms), count(*) into better, total
    from public.dose_plays where game = 'rewire' and day = today and finished_at is not null;
  update public.dose_plays set won = true, finished_at = now(),
    result = jsonb_build_object('ms', ms, 'hints', jsonb_array_length(play.guesses), 'taps', taps, 'par', v_par, 'stars', stars,
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1)
  where user_id = uid and game = 'rewire' and day = today
  returning result into c;
  return c;
end $$;

create or replace function public.dose_hunch_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'hunch' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'hunch', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'hunch' and day = today;
  return jsonb_build_object(
    'questions', (select jsonb_agg(q - 'answer' - 'source' order by o) from jsonb_array_elements(c->'questions') with ordinality e(q, o)),
    'themed', c ? 'theme',
    'guesses', play.guesses, 'result', play.result);
end $$;

create or replace function public.dose_hunch_bet(p_i int, p_v numeric, p_band int, p_double boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
  c jsonb; q jsonb; play public.dose_plays;
  lo numeric; hi numeric; a numeric; islog boolean; isyear boolean;
  err numeric; others numeric[]; w_avg numeric; bins int[]; b int; v numeric;
  inside boolean; rel numeric; pts int; lo_b numeric; hi_b numeric;
  g jsonb; done boolean; res jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_band is null or p_band not between 0 and 2 then raise exception 'bad band' using errcode = '22023'; end if;
  select content into c from public.dose_puzzles where game = 'hunch' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'hunch' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if p_i is distinct from jsonb_array_length(play.guesses) or p_i >= jsonb_array_length(c->'questions') then
    raise exception 'wrong question' using errcode = '22023';
  end if;
  if coalesce(p_double, false) and exists (select 1 from jsonb_array_elements(play.guesses) x where (x->>'dbl')::boolean) then
    raise exception 'already doubled today' using errcode = '22023';
  end if;
  q := c->'questions'->p_i;
  lo := (q->>'min')::numeric; hi := (q->>'max')::numeric; a := (q->>'answer')::numeric;
  islog := coalesce((q->>'log')::boolean, false); isyear := coalesce(q->>'unit', '') = '' and lo >= 1000;
  if p_v is null or p_v < lo or p_v > hi then raise exception 'out of range' using errcode = '22023'; end if;

  err := round(case when isyear then abs(p_v - a) / (hi - lo) else abs(p_v - a) / a end * 100, 1);

  if isyear then
    lo_b := p_v - (array[1, 3, 8])[p_band + 1]; hi_b := p_v + (array[1, 3, 8])[p_band + 1];
  elsif islog then
    lo_b := p_v / (array[1.1, 1.3, 1.6])[p_band + 1]; hi_b := p_v * (array[1.1, 1.3, 1.6])[p_band + 1];
  else
    lo_b := p_v - (hi - lo) * (array[.02, .06, .15])[p_band + 1]; hi_b := p_v + (hi - lo) * (array[.02, .06, .15])[p_band + 1];
  end if;
  inside := a >= lo_b and a <= hi_b;
  rel := case when islog and not isyear then abs(ln(a / p_v)) / ln(hi_b / p_v) else abs(a - p_v) / nullif(hi_b - p_v, 0) end;
  pts := case when inside then round((array[100, 50, 20])[p_band + 1] * (1 - .5 * least(coalesce(rel, 0), 1))) else 0 end;
  if coalesce(p_double, false) then pts := case when inside then pts * 2 else -30 end; end if;

  others := array(select (p.guesses->p_i->>'v')::numeric from public.dose_plays p
    where p.game = 'hunch' and p.day = today and p.user_id <> uid and jsonb_array_length(p.guesses) > p_i);
  if cardinality(others) > 0 then
    w_avg := case when islog then exp((select avg(ln(x)) from unnest(others) x)) else (select avg(x) from unnest(others) x) end;
  end if;
  bins := array_fill(0, array[24]);
  foreach v in array others loop
    b := least(23, floor(24 * case when islog then ln(v / lo) / ln(hi / lo) else (v - lo) / (hi - lo) end))::int;
    bins[b + 1] := bins[b + 1] + 1;
  end loop;

  g := jsonb_build_object('v', p_v, 'a', a, 'err', err, 'avg', round(w_avg, 2), 'n', cardinality(others), 'bins', to_jsonb(bins),
    'beat', case when w_avg is not null then abs(p_v - a) < abs(w_avg - a) end, 'source', q->'source',
    'band', p_band, 'lo', round(lo_b, 2), 'hi', round(hi_b, 2), 'in', inside, 'pts', pts, 'dbl', coalesce(p_double, false));
  done := p_i + 1 = jsonb_array_length(c->'questions');
  if done then
    select jsonb_build_object(
      'points', sum((x->>'pts')::int), 'hits', count(*) filter (where (x->>'in')::boolean),
      'err', round(avg((x->>'err')::numeric), 1),
      'beat', count(*) filter (where (x->>'beat')::boolean), 'rated', count(*) filter (where x->>'beat' is not null),
      'theme', c->'theme')
      into res from jsonb_array_elements(play.guesses || jsonb_build_array(g)) x;
  end if;
  update public.dose_plays set guesses = guesses || jsonb_build_array(g),
    finished_at = case when done then now() end, won = case when done then true end, result = res
  where user_id = uid and game = 'hunch' and day = today;
  return g || jsonb_build_object('result', res);
end $$;

create or replace function public.dose_tangle_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'tangle' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'tangle', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'tangle' and day = today;
  return jsonb_build_object('n', c->'n', 'edges', c->'edges', 'start', c->'start',
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result,
    'board', case when play.finished_at is not null then play.guesses end);
end $$;

create or replace function public.dose_tangle_submit(p_pos jsonb, p_moves int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
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

create or replace function public.dose_ladder_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'ladder' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'ladder', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'ladder' and day = today;
  return public.dose_ladder_state(c, play);
end $$;

create or replace function public.dose_ladder_step(p_word text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
  c jsonb; play public.dose_plays; chain jsonb; w text := lower(trim(coalesce(p_word, ''))); last text;
  diff int := 0; i int; res jsonb; ms int; steps int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'ladder' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'ladder' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_ladder_state(c, play); end if;
  chain := case when jsonb_array_length(play.guesses) > 0 then play.guesses else jsonb_build_array(c->'start') end;
  ms := floor(extract(epoch from now() - play.started_at) * 1000);

  if w = 'back' then
    if jsonb_array_length(chain) > 1 then chain := chain - (jsonb_array_length(chain) - 1); end if;
  elsif w = 'give up' then
    res := jsonb_build_object('solved', false, 'par', c->'par', 'path', c->'path', 'ms', ms);
  else
    last := chain->>(jsonb_array_length(chain) - 1);
    if w !~ '^[a-z]{4}$' then raise exception 'four letters' using errcode = '22023'; end if;
    for i in 1..4 loop if substr(w, i, 1) <> substr(last, i, 1) then diff := diff + 1; end if; end loop;
    if diff <> 1 then raise exception 'change one letter' using errcode = '22023'; end if;
    if chain ? w then raise exception 'already used' using errcode = '22023'; end if;
    if not exists (select 1 from public.dose_words where word = w) then raise exception 'not a word' using errcode = '22023'; end if;
    chain := chain || to_jsonb(w);
    if w = c->>'end' then
      steps := jsonb_array_length(chain) - 1;
      select count(*) filter (where not coalesce((result->>'solved')::boolean, false) or (result->>'steps')::int > steps
                                 or ((result->>'steps')::int = steps and (result->>'ms')::int > ms)), count(*)
        into better, total from public.dose_plays where game = 'ladder' and day = today and finished_at is not null;
      res := jsonb_build_object('solved', true, 'steps', steps, 'par', c->'par', 'path', c->'path', 'ms', ms,
        'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
    end if;
  end if;
  update public.dose_plays set guesses = chain, result = res, finished_at = case when res is not null then now() end,
    won = case when res is not null then (res->>'solved')::boolean end
    where user_id = uid and game = 'ladder' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'ladder' and day = today;
  return public.dose_ladder_state(c, play);
end $$;

create or replace function public.dose_friends_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', p.display_name, 'results',
      coalesce((select jsonb_object_agg(x.game, x.result - 'theme' - 'beat' - 'players' - 'path' - 'answers' - 'words') from public.dose_plays x
                where x.user_id = f.id and x.day = today and x.finished_at is not null), '{}'::jsonb))
      order by p.display_name nulls last)
    from (select case when d.a = uid then d.b else d.a end as id from public.dose_friends d where d.a = uid or d.b = uid) f
    left join public.dose_profiles p on p.id = f.id), '[]'::jsonb);
end $$;

create or replace function public.dose_link_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'link' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'link', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today;
  return public.dose_link_state(c, play);
end $$;

create or replace function public.dose_link_guess(p_k int, p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
  c jsonb; play public.dose_plays; g jsonb; k int; n int; tries jsonb; w text; pts int := 0; solved int := 0; open int := 0;
  res jsonb; ms int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'link' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_link_state(c, play); end if;
  n := jsonb_array_length(c->'links');
  if p_k is null or p_k < 0 or p_k >= n then raise exception 'bad link' using errcode = '22023'; end if;
  w := case when trim(coalesce(p_guess, '')) = '?' then '?' else regexp_replace(lower(coalesce(p_guess, '')), '[^a-z]', '', 'g') end;
  if w = '' or length(w) > 20 then raise exception 'type a word' using errcode = '22023'; end if;

  g := coalesce(play.guesses, '[]');
  while jsonb_array_length(g) < n loop g := g || '[[]]'::jsonb; end loop;
  tries := g->p_k;
  if jsonb_array_length(tries) > 0 and (public.dose_link_ok(tries->>-1, c->'links'->p_k) or jsonb_array_length(tries) >= 3 or tries->>-1 = '?') then
    raise exception 'link done' using errcode = '22023';
  end if;
  if w <> '?' and tries ? w then raise exception 'already tried' using errcode = '22023'; end if;
  g := jsonb_set(g, array[p_k::text], tries || to_jsonb(w));

  for k in 0..n - 1 loop
    tries := g->k;
    if jsonb_array_length(tries) > 0 and public.dose_link_ok(tries->>-1, c->'links'->k) then solved := solved + 1; pts := pts + 4 - jsonb_array_length(tries);
    elsif not (jsonb_array_length(tries) >= 3 or coalesce(tries->>-1 = '?', false)) then open := open + 1;
    end if;
  end loop;
  if open = 0 then
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    select count(*) filter (where (result->>'score')::int < pts or ((result->>'score')::int = pts and (result->>'ms')::int > ms)), count(*)
      into better, total from public.dose_plays where game = 'link' and day = today and finished_at is not null;
    res := jsonb_build_object('score', pts, 'solved', solved, 'ms', ms,
      'tries', (select jsonb_agg(case when jsonb_array_length(t) > 0 and public.dose_link_ok(t->>-1, c->'links'->(i - 1)::int) then jsonb_array_length(t) else 0 end)
                from jsonb_array_elements(g) with ordinality as e(t, i)),
      'answers', (select jsonb_agg(l->'answer') from jsonb_array_elements(c->'links') l),
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  end if;
  update public.dose_plays set guesses = g, result = res, finished_at = case when res is not null then now() end, won = case when res is not null then solved > 0 end
    where user_id = uid and game = 'link' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today;
  return public.dose_link_state(c, play);
end $$;

create or replace function public.dose_anagram_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'anagram' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'anagram', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'anagram' and day = today;
  return public.dose_anagram_state(c, play);
end $$;

create or replace function public.dose_anagram_guess(p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
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
