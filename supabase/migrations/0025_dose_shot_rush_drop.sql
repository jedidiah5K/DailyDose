-- Daily Dose, setup 25: The Shot, Rush and Drop (Job, 2026-11-14). Safe to run twice.
-- The Shot (game 'shot'): one question a day, 7 seconds, one typed answer.
-- Rush (game 'rush'): one category, 30 seconds, type as many listed answers as you can. Rarer = more points.
-- Drop (game 'hilo'; the old 'drop' key belongs to the retired game): a chain of items with hidden numbers.
--   Call each next one higher or lower within 7 seconds. Every right call doubles the pot (10, 20, 40...).
--   Bank it any time between calls; one wrong or late call loses everything.
-- Every clock runs on the server, with 2 seconds of grace for the network.

alter table public.dose_plays drop constraint if exists dose_plays_game_check;
alter table public.dose_plays add constraint dose_plays_game_check check (game in
  ('vault', 'rewire', 'hunch', 'drop', 'meld', 'last', 'tangle', 'cipher', 'ladder', 'link', 'anagram', 'bluff', 'zoom', 'echo',
   'blend', 'rush', 'shot', 'hilo'));

create or replace function public.dose_ms_since(o jsonb) returns numeric
language sql stable set search_path = '' as $$ select extract(epoch from now()) * 1000 - (o #>> '{}')::numeric $$;
revoke all on function public.dose_ms_since(jsonb) from public, anon, authenticated;

-- ---------- The Shot ----------
create or replace function public.dose_shot_clean(raw text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(btrim(regexp_replace(regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g')), '^(the|a|an) ', '')
$$;
revoke all on function public.dose_shot_clean(text) from public, anon, authenticated;

create or replace function public.dose_shot_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := play.guesses; open boolean := jsonb_typeof(play.guesses) = 'object' and play.guesses ? 'o';
begin
  return jsonb_build_object('opened', open,
    'q', case when open then c->'q' end,
    -- near-miss shape: letters per word, e.g. [8] or [3, 5]
    'shape', case when open then (select jsonb_agg(length(w)) from regexp_split_to_table(c->>'show', ' ') w) end,
    'left_ms', case when open and play.result is null then greatest(0, 7000 - public.dose_ms_since(g->'o'))::int end,
    'result', play.result);
end $$;
revoke all on function public.dose_shot_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_shot_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'shot' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'shot', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'shot' and day = today;
  return public.dose_shot_state(c, play);
end $$;

create or replace function public.dose_shot_open() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'shot' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'shot' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if jsonb_typeof(play.guesses) <> 'object' then
    update public.dose_plays set guesses = jsonb_build_object('o', floor(extract(epoch from now()) * 1000))
      where user_id = uid and game = 'shot' and day = today returning * into play;
  end if;
  return public.dose_shot_state(c, play);
end $$;

create or replace function public.dose_shot_answer(p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
  w text := public.dose_shot_clean(p_text); el numeric; ok boolean; got int; tot int; slower int; quick int; res jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'shot' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'shot' and day = today for update;
  if c is null or play.user_id is null or jsonb_typeof(play.guesses) <> 'object' then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_shot_state(c, play); end if;
  el := public.dose_ms_since(play.guesses->'o');
  ok := el <= 9000 and w <> '' and exists (select 1 from jsonb_array_elements_text(c->'a') x
          where replace(x, ' ', '') in (replace(w, ' ', ''), regexp_replace(replace(w, ' ', ''), 's$', '')));
  select count(*) filter (where (result->>'ok')::boolean), count(*),
         count(*) filter (where (result->>'ok')::boolean and (result->>'ms')::int > least(el, 7000))
    into got, tot, slower from public.dose_plays where game = 'shot' and day = today and finished_at is not null;
  quick := least(el, 7000)::int;
  res := jsonb_build_object('ok', ok, 'ms', quick, 'answer', c->'show',
    'pct', round(100.0 * (got + ok::int) / (tot + 1)), 'players', tot + 1,
    'beat', case when ok and got > 0 then round(100.0 * slower / got) end);
  update public.dose_plays set guesses = play.guesses || jsonb_build_object('r', left(w, 30)), result = res, finished_at = now(), won = ok
    where user_id = uid and game = 'shot' and day = today returning * into play;
  return public.dose_shot_state(c, play);
end $$;

-- ---------- Rush ----------
-- Content is shaped like a Blend prompt ({q, answers: {word: weight}, alias}), so it reuses dose_blend_norm.
create or replace function public.dose_rush_tier(w numeric) returns int
language sql immutable set search_path = '' as $$ select case when w >= 3 then 1 when w >= 1 then 2 else 3 end $$;
revoke all on function public.dose_rush_tier(numeric) from public, anon, authenticated;

create or replace function public.dose_rush_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := play.guesses; open boolean := jsonb_typeof(play.guesses) = 'object' and play.guesses ? 'o';
begin
  return jsonb_build_object('opened', open, 'q', case when open then c->'q' end,
    'found', case when open then g->'f' else '[]' end,
    'points', case when open then (select coalesce(sum((e->>'p')::int), 0) from jsonb_array_elements(g->'f') e) else 0 end,
    'left_ms', case when open and play.result is null then greatest(0, 30000 - public.dose_ms_since(g->'o'))::int end,
    'result', play.result);
end $$;
revoke all on function public.dose_rush_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_rush_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rush' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'rush', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'rush' and day = today;
  return public.dose_rush_state(c, play);
end $$;

create or replace function public.dose_rush_open() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rush' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'rush' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if jsonb_typeof(play.guesses) <> 'object' then
    update public.dose_plays set guesses = jsonb_build_object('o', floor(extract(epoch from now()) * 1000), 'f', '[]'::jsonb)
      where user_id = uid and game = 'rush' and day = today returning * into play;
  end if;
  return public.dose_rush_state(c, play);
end $$;

-- One typed answer. Returns the state plus "last": what happened to this answer.
create or replace function public.dose_rush_add(p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; a text; p int; f jsonb; last jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rush' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'rush' and day = today for update;
  if c is null or play.user_id is null or jsonb_typeof(play.guesses) <> 'object' then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null or public.dose_ms_since(play.guesses->'o') > 32000 then raise exception 'time up' using errcode = '22023'; end if;
  f := play.guesses->'f';
  a := public.dose_blend_norm(c, p_text);
  if a is null then last := jsonb_build_object('why', 'not on our list');
  elsif exists (select 1 from jsonb_array_elements(f) e where e->>'a' = a) then last := jsonb_build_object('a', a, 'why', 'already got it');
  elsif jsonb_array_length(f) >= 150 then last := jsonb_build_object('why', 'that’s plenty');
  else
    p := public.dose_rush_tier((c->'answers'->>a)::numeric);
    f := f || jsonb_build_array(jsonb_build_object('a', a, 'p', p));
    last := jsonb_build_object('a', a, 'p', p);
    update public.dose_plays set guesses = jsonb_set(guesses, '{f}', f) where user_id = uid and game = 'rush' and day = today returning * into play;
  end if;
  return public.dose_rush_state(c, play) || jsonb_build_object('last', last);
end $$;

-- Time's up (or you stop early): score it, and show the common answers you missed.
create or replace function public.dose_rush_finish() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; f jsonb; pts int; better int; tot int; res jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'rush' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'rush' and day = today for update;
  if c is null or play.user_id is null or jsonb_typeof(play.guesses) <> 'object' then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_rush_state(c, play); end if;
  f := play.guesses->'f';
  pts := (select coalesce(sum((e->>'p')::int), 0) from jsonb_array_elements(f) e);
  select count(*) filter (where (result->>'points')::int < pts), count(*) into better, tot
    from public.dose_plays where game = 'rush' and day = today and finished_at is not null;
  res := jsonb_build_object('found', jsonb_array_length(f), 'points', pts,
    'rare', (select count(*) from jsonb_array_elements(f) e where (e->>'p')::int = 3),
    'missed', (select coalesce(jsonb_agg(k), '[]') from (select k from jsonb_each_text(c->'answers') as x(k, w)
                where not exists (select 1 from jsonb_array_elements(f) e where e->>'a' = x.k) order by x.w::numeric desc, k limit 3) m),
    'listed', (select count(*) from jsonb_object_keys(c->'answers')),
    'beat', case when tot > 0 then round(100.0 * better / tot) end, 'players', tot + 1);
  update public.dose_plays set result = res, finished_at = now(), won = pts > 0
    where user_id = uid and game = 'rush' and day = today returning * into play;
  return public.dose_rush_state(c, play);
end $$;

-- ---------- Drop (game 'hilo') ----------
-- Content: {theme, hi, lo, items: [{n: name, v: number, s: "shown value"}]}. guesses: one step per opened card,
-- {o} while it waits for your call, then {o, c: 'hi'|'lo', ok}. Step k compares item k+1 with item k.
create or replace function public.dose_hilo_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := coalesce(play.guesses, '[]'); n int := jsonb_array_length(coalesce(play.guesses, '[]'));
  pending boolean; rights int; answered int;
begin
  pending := n > 0 and not (g->(n - 1) ? 'c');
  answered := n - pending::int;
  rights := (select count(*) from jsonb_array_elements(g) e where (e->>'ok')::boolean);
  return jsonb_build_object('theme', c->'theme', 'hi', c->'hi', 'lo', c->'lo', 'len', jsonb_array_length(c->'items'),
    'chain', (select jsonb_agg(jsonb_build_object('n', i->'n', 's', i->'s') order by k) from jsonb_array_elements(c->'items') with ordinality as t(i, k) where k <= answered + 1),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('c', e->'c', 'ok', e->'ok')), '[]') from jsonb_array_elements(g) e where e ? 'c'),
    'next', case when pending then jsonb_build_object('n', c->'items'->n->'n', 'left_ms', greatest(0, 7000 - public.dose_ms_since(g->(n - 1)->'o'))::int) end,
    'pot', (10 * power(2, rights))::bigint, 'result', play.result);
end $$;
revoke all on function public.dose_hilo_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_hilo_finish(c jsonb, play public.dose_plays, g jsonb, bust boolean) returns jsonb
language plpgsql set search_path = '' as $$
declare rights int; pot bigint; better int; tot int; mid numeric; res jsonb; len int := jsonb_array_length(c->'items');
begin
  rights := (select count(*) from jsonb_array_elements(g) e where (e->>'ok')::boolean);
  pot := case when bust then 0 else (10 * power(2, rights))::bigint end;
  select count(*) filter (where (result->>'banked')::bigint < pot), count(*),
         percentile_cont(0.5) within group (order by (result->>'rights')::int)
    into better, tot, mid from public.dose_plays where game = 'hilo' and day = play.day and finished_at is not null;
  res := jsonb_build_object('banked', pot, 'rights', rights, 'bust', bust, 'cleared', rights = len - 1, 'len', len,
    'chain', (select jsonb_agg(jsonb_build_object('n', i->'n', 's', i->'s')) from jsonb_array_elements(c->'items') i),
    'crowd', round(mid), 'beat', case when tot > 0 then round(100.0 * better / tot) end, 'players', tot + 1);
  update public.dose_plays set guesses = g, result = res, finished_at = now(), won = not bust
    where user_id = play.user_id and game = 'hilo' and day = play.day returning * into play;
  return public.dose_hilo_state(c, play);
end $$;
revoke all on function public.dose_hilo_finish(jsonb, public.dose_plays, jsonb, boolean) from public, anon, authenticated;

create or replace function public.dose_hilo_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'hilo' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'hilo', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'hilo' and day = today;
  return public.dose_hilo_state(c, play);
end $$;

-- Turn over the next card's name. Its 7 seconds start now.
create or replace function public.dose_hilo_open() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; g jsonb; n int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'hilo' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'hilo' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  g := coalesce(play.guesses, '[]'); n := jsonb_array_length(g);
  if play.finished_at is null and (n = 0 or (g->(n - 1)->>'ok')::boolean) and n + 1 < jsonb_array_length(c->'items') then
    update public.dose_plays set guesses = g || jsonb_build_array(jsonb_build_object('o', floor(extract(epoch from now()) * 1000)))
      where user_id = uid and game = 'hilo' and day = today returning * into play;
  end if;
  return public.dose_hilo_state(c, play);
end $$;

create or replace function public.dose_hilo_call(p_dir text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; g jsonb; n int; k int;
  a numeric; b numeric; ok boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  -- 'out' = the clock ran out on the phone: a miss
  if p_dir is null or p_dir not in ('hi', 'lo', 'out') then raise exception 'bad call' using errcode = '22023'; end if;
  select content into c from public.dose_puzzles where game = 'hilo' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'hilo' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_hilo_state(c, play); end if;
  g := coalesce(play.guesses, '[]'); n := jsonb_array_length(g); k := n - 1;
  if n = 0 or g->k ? 'c' then raise exception 'no card open' using errcode = '22023'; end if;
  a := (c->'items'->k->>'v')::numeric; b := (c->'items'->(k + 1)->>'v')::numeric;
  ok := public.dose_ms_since(g->k->'o') <= 9000 and ((p_dir = 'hi' and b >= a) or (p_dir = 'lo' and b <= a));
  g := jsonb_set(g, array[k::text], g->k || jsonb_build_object('c', p_dir, 'ok', ok));
  if not ok then return public.dose_hilo_finish(c, play, g, true); end if;
  if k + 2 = jsonb_array_length(c->'items') then return public.dose_hilo_finish(c, play, g, false); end if;
  update public.dose_plays set guesses = g where user_id = uid and game = 'hilo' and day = today returning * into play;
  return public.dose_hilo_state(c, play);
end $$;

-- Bank the pot (only between cards, never with one turned over).
create or replace function public.dose_hilo_bank() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; g jsonb; n int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'hilo' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'hilo' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_hilo_state(c, play); end if;
  g := coalesce(play.guesses, '[]'); n := jsonb_array_length(g);
  if n > 0 and not (g->(n - 1) ? 'c') then raise exception 'call it first' using errcode = '22023'; end if;
  return public.dose_hilo_finish(c, play, g, false);
end $$;

do $$ declare f text; begin
  foreach f in array array['dose_shot_start()', 'dose_shot_open()', 'dose_shot_answer(text)', 'dose_rush_start()', 'dose_rush_open()',
    'dose_rush_add(text)', 'dose_rush_finish()', 'dose_hilo_start()', 'dose_hilo_open()', 'dose_hilo_call(text)', 'dose_hilo_bank()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
