-- Daily Dose, setup 24: Blend (Job, 2026-11-14). Five prompts a day, 20 seconds each, typed answers.
-- Each prompt is "Think like everyone" (mode crowd: match the most common answer) or "Think like no one"
-- (mode rare: a real answer few people gave). Answers must be on the prompt's list (no gibberish wins).
-- Until enough people play, each list's guessed weights stand in for the crowd: every seeded weight point
-- counts as half a player, so 100 points of seed = 50 pretend players, and real answers soon take over.
-- The timer runs on the server: a prompt opens when you ask for it, and an answer after 22 s (20 + 2 grace
-- for the network) scores nothing. Prompts open in order; you only ever see the ones you have opened.
-- Safe to run twice.

alter table public.dose_plays drop constraint if exists dose_plays_game_check;
alter table public.dose_plays add constraint dose_plays_game_check check (game in
  ('vault', 'rewire', 'hunch', 'drop', 'meld', 'last', 'tangle', 'cipher', 'ladder', 'link', 'anagram', 'bluff', 'zoom', 'echo',
   'blend', 'rush', 'shot'));

-- How many players gave each answer, per puzzle day and prompt. No policies: only the functions read it.
create table if not exists public.dose_blend_counts (
  day date not null,
  k int not null,
  answer text not null,
  n int not null default 0,
  primary key (day, k, answer)
);
alter table public.dose_blend_counts enable row level security;

-- Typed text -> the listed answer it means (plurals, aliases, missing spaces), or null if it isn't listed.
create or replace function public.dose_blend_norm(pr jsonb, raw text) returns text
language plpgsql immutable set search_path = '' as $$
declare w text := btrim(regexp_replace(regexp_replace(lower(coalesce(raw, '')), '[^a-z ]', '', 'g'), '\s+', ' ', 'g')); t text; v text; vs text[];
begin
  if w = '' or length(w) > 30 then return null; end if;
  w := regexp_replace(w, '^(the|a|an) ', '');
  vs := array[w, regexp_replace(w, 'ies$', 'y'), regexp_replace(w, 'es$', ''), regexp_replace(w, 's$', '')];
  -- "a word after ICE": typing the whole "ice cream" counts as "cream"
  if pr ? 'drop' then
    v := regexp_replace(w, '^' || (pr->>'drop') || ' ?', '');
    if v <> '' then vs := vs || array[v, regexp_replace(v, 's$', '')]; end if;
  end if;
  foreach t in array vs loop
    if pr->'answers' ? t then return t; end if;
    if coalesce(pr->'alias', '{}') ? t then return pr->'alias'->>t; end if;
  end loop;
  -- spaces don't matter: "spiderman" = "spider man"
  select o.key into v from jsonb_object_keys(pr->'answers') as o(key)
    where replace(o.key, ' ', '') in (select replace(x, ' ', '') from unnest(vs) x) limit 1;
  if v is not null then return v; end if;
  select o.value into v from jsonb_each_text(coalesce(pr->'alias', '{}')) as o
    where replace(o.key, ' ', '') in (select replace(x, ' ', '') from unnest(vs) x) limit 1;
  return v;
end $$;
revoke all on function public.dose_blend_norm(jsonb, text) from public, anon, authenticated;

-- Where an answer stands: its share of all answers (%), its size next to the top answer (0..1), the top three.
create or replace function public.dose_blend_score(p_day date, p_k int, pr jsonb, ans text) returns jsonb
language sql stable set search_path = '' as $$
  with e as (
    select a.key as a, a.value::numeric * 0.5 + coalesce(c.n, 0) as w
    from jsonb_each_text(pr->'answers') a
    left join public.dose_blend_counts c on c.day = p_day and c.k = p_k and c.answer = a.key)
  select jsonb_build_object(
    'share', round(100 * (select w from e where a = ans) / nullif((select sum(w) from e), 0), 1),
    'p', (select w from e where a = ans) / nullif((select max(w) from e), 0),
    'top', (select jsonb_agg(jsonb_build_array(t.a, round(100 * t.w / (select sum(w) from e)))) from (select * from e order by w desc, a limit 3) t))
$$;
revoke all on function public.dose_blend_score(date, int, jsonb, text) from public, anon, authenticated;

-- What the phone may see: the five modes, and only the prompts already opened.
create or replace function public.dose_blend_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := coalesce(play.guesses, '[]'); out jsonb := '[]'; k int; x jsonb; pr jsonb;
begin
  for k in 0..jsonb_array_length(g) - 1 loop
    x := g->k; pr := c->'prompts'->k;
    out := out || jsonb_build_object('q', pr->'q', 'mode', pr->'mode', 'done', x ? 'p',
      'raw', x->'r', 'answer', x->'a', 'points', x->'p', 'share', x->'s', 'top', x->'top', 'gem', x->'gem', 'late', x->'late',
      'left_ms', case when not (x ? 'p') then greatest(0, 20000 - (extract(epoch from now()) * 1000 - (x->>'o')::numeric))::int end);
  end loop;
  return jsonb_build_object('n', jsonb_array_length(c->'prompts'), 'prompts', out,
    'modes', (select jsonb_agg(p->'mode') from jsonb_array_elements(c->'prompts') p), 'result', play.result);
end $$;
revoke all on function public.dose_blend_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_blend_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'blend' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'blend', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'blend' and day = today;
  return public.dose_blend_state(c, play);
end $$;

-- Open prompt k (the next one, once the one before is answered). Its 20 seconds start now.
create or replace function public.dose_blend_open(p_k int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; g jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'blend' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'blend' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  g := coalesce(play.guesses, '[]');
  if play.finished_at is null and p_k = jsonb_array_length(g) and p_k < jsonb_array_length(c->'prompts')
     and (p_k = 0 or g->(p_k - 1) ? 'p') then
    g := g || jsonb_build_array(jsonb_build_object('o', floor(extract(epoch from now()) * 1000)));
    update public.dose_plays set guesses = g where user_id = uid and game = 'blend' and day = today;
    select * into play from public.dose_plays where user_id = uid and game = 'blend' and day = today;
  end if;
  return public.dose_blend_state(c, play);
end $$;

-- Answer the open prompt. Blank or late = 0 points. The last answer finishes the game.
create or replace function public.dose_blend_answer(p_k int, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
  c jsonb; play public.dose_plays; g jsonb; x jsonb; pr jsonb; a text; late boolean; sc jsonb; pts int := 0; n int;
  res jsonb; total int; better int; tot int; ms int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'blend' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'blend' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_blend_state(c, play); end if;
  g := coalesce(play.guesses, '[]'); n := jsonb_array_length(c->'prompts');
  if p_k is null or p_k <> jsonb_array_length(g) - 1 or g->p_k ? 'p' then raise exception 'not open' using errcode = '22023'; end if;
  x := g->p_k; pr := c->'prompts'->p_k;
  late := extract(epoch from now()) * 1000 - (x->>'o')::numeric > 22000;
  a := case when late then null else public.dose_blend_norm(pr, p_text) end;
  -- score against everyone before you, then add your answer to the count
  sc := public.dose_blend_score(today, p_k, pr, coalesce(a, ''));
  if a is not null then
    insert into public.dose_blend_counts as t (day, k, answer, n) values (today, p_k, a, 1)
      on conflict (day, k, answer) do update set n = t.n + 1;
  end if;
  if a is not null then
    pts := case when pr->>'mode' = 'rare' then greatest(10, round(100 * (1 - (sc->>'p')::numeric)))
                else greatest(5, round(100 * (sc->>'p')::numeric)) end;
  end if;
  x := x || jsonb_build_object('r', left(btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z ]', '', 'g')), 30),
    'a', a, 'p', pts, 's', sc->'share', 'top', sc->'top', 'late', late,
    'gem', a is not null and pr->>'mode' = 'rare' and (sc->>'share')::numeric < 3);
  g := jsonb_set(g, array[p_k::text], x);

  if p_k = n - 1 then
    total := (select sum((e->>'p')::int) from jsonb_array_elements(g) e);
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    select count(*) filter (where (result->>'score')::int < total), count(*) into better, tot
      from public.dose_plays where game = 'blend' and day = today and finished_at is not null;
    res := jsonb_build_object('score', total, 'ms', ms,
      'points', (select jsonb_agg(e->'p') from jsonb_array_elements(g) e),
      'gems', (select jsonb_agg(coalesce((e->>'gem')::boolean, false)) from jsonb_array_elements(g) e),
      'modes', (select jsonb_agg(p->'mode') from jsonb_array_elements(c->'prompts') p),
      'beat', case when tot > 0 then round(100.0 * better / tot) end, 'players', tot + 1);
  end if;
  update public.dose_plays set guesses = g, result = res,
    finished_at = case when res is not null then now() end, won = case when res is not null then total > 0 end
    where user_id = uid and game = 'blend' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'blend' and day = today;
  return public.dose_blend_state(c, play);
end $$;

revoke all on function public.dose_blend_start() from public, anon;
revoke all on function public.dose_blend_open(int) from public, anon;
revoke all on function public.dose_blend_answer(int, text) from public, anon;
grant execute on function public.dose_blend_start() to authenticated;
grant execute on function public.dose_blend_open(int) to authenticated;
grant execute on function public.dose_blend_answer(int, text) to authenticated;
