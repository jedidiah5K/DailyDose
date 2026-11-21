-- Emoji Decode and Imposter (Job, 2026-11-21): they replace Ladder and Rush on home.
-- Emoji Decode: five things in emojis. You see 2; each wrong guess or '+' (another emoji) shows one more, up to 6.
--   A miss with all 6 showing ends that one. Points = 7 - emojis needed (2 = 5 points ... 6 = 1), out of 25.
-- Imposter: five rounds of four names; one tap per round picks the one that doesn't belong. Score out of 5.
-- Answers, hidden emojis, imposters and links never leave the server before you answer. Safe to run twice.

alter table public.dose_plays drop constraint if exists dose_plays_game_check;
alter table public.dose_plays add constraint dose_plays_game_check check (game = any (array['vault','rewire','hunch','drop','meld','last','tangle','cipher','ladder','link','anagram','bluff','zoom','echo','blend','rush','shot','hilo','emoji','imposter']));

-- lowercase, accents off, punctuation off, no leading the/a/an, single spaces
create or replace function public.dose_clean(x text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(trim(regexp_replace(regexp_replace(lower(translate(coalesce(x, ''),
    'ÉÈÊËÁÀÂÄÍÌÎÏÓÒÔÖÚÙÛÜÑÇéèêëáàâäíìîïóòôöúùûüñç', 'EEEEAAAAIIIIOOOOUUUUNCeeeeaaaaiiiioooouuuunc')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g')), '^(the|a|an) ', ''), '\s+', ' ', 'g')
$$;
revoke all on function public.dose_clean(text) from public, anon, authenticated;

create or replace function public.dose_emoji_ok(typed text, p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select exists (select 1 from jsonb_array_elements_text(p->'a') a
    where public.dose_clean(a) = public.dose_clean(typed) or public.dose_typo_ok(public.dose_clean(a), public.dose_clean(typed)))
$$;
revoke all on function public.dose_emoji_ok(text, jsonb) from public, anon, authenticated;

create or replace function public.dose_emoji_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := coalesce(play.guesses, '[]'); n int := jsonb_array_length(c->'puzzles'); out jsonb := '[]'; k int; t jsonb; ok boolean; fin boolean; shown int;
begin
  for k in 0..n - 1 loop
    t := coalesce(g->k, '[]');
    ok := jsonb_array_length(t) > 0 and t->>-1 <> '+' and public.dose_emoji_ok(t->>-1, c->'puzzles'->k);
    fin := ok or jsonb_array_length(t) >= 5;
    shown := case when fin then 6 else 2 + jsonb_array_length(t) end;
    out := out || jsonb_build_object('cat', c->'puzzles'->k->>'cat',
      'e', (select jsonb_agg(x order by i) from jsonb_array_elements(c->'puzzles'->k->'e') with ordinality e(x, i) where i <= shown),
      'done', fin, 'solved', ok, 'used', case when ok then jsonb_array_length(t) + 1 end,
      'answer', case when fin then c->'puzzles'->k->'a'->>0 end);
  end loop;
  return jsonb_build_object('puzzles', out, 'result', play.result);
end $$;
revoke all on function public.dose_emoji_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_emoji_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'emoji' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'emoji', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'emoji' and day = today;
  return public.dose_emoji_state(c, play);
end $$;

-- p_guess: a typed guess, or '+' for another emoji (a '+' with 6 showing gives that one up)
create or replace function public.dose_emoji_guess(p_k int, p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; g jsonb; n int; k int; t jsonb; w text;
  ok boolean; cur int := -1; pts int := 0; solved int := 0; res jsonb; ms int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'emoji' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'emoji' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_emoji_state(c, play); end if;
  n := jsonb_array_length(c->'puzzles'); g := coalesce(play.guesses, '[]');
  while jsonb_array_length(g) < n loop g := g || '[[]]'::jsonb; end loop;
  -- puzzles go in order: only the first unfinished one takes guesses
  for k in 0..n - 1 loop
    t := g->k;
    if not ((jsonb_array_length(t) > 0 and t->>-1 <> '+' and public.dose_emoji_ok(t->>-1, c->'puzzles'->k)) or jsonb_array_length(t) >= 5) then cur := k; exit; end if;
  end loop;
  if p_k is distinct from cur then raise exception 'wrong puzzle' using errcode = '22023'; end if;
  w := case when trim(coalesce(p_guess, '')) = '+' then '+' else left(trim(coalesce(p_guess, '')), 40) end;
  if public.dose_clean(w) = '' and w <> '+' then raise exception 'type a guess' using errcode = '22023'; end if;
  -- the 6th emoji's '+' or a miss at 6 ends it; a give-up is stored as '+'
  g := jsonb_set(g, array[cur::text], (g->cur) || to_jsonb(w));

  if cur = n - 1 and ((w <> '+' and public.dose_emoji_ok(w, c->'puzzles'->cur)) or jsonb_array_length(g->cur) >= 5) then
    for k in 0..n - 1 loop
      t := g->k; ok := t->>-1 <> '+' and public.dose_emoji_ok(t->>-1, c->'puzzles'->k);
      if ok then solved := solved + 1; pts := pts + 6 - jsonb_array_length(t); end if;
    end loop;
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    select count(*) filter (where (result->>'score')::int < pts or ((result->>'score')::int = pts and (result->>'ms')::int > ms)), count(*)
      into better, total from public.dose_plays where game = 'emoji' and day = today and finished_at is not null;
    -- 'used' per puzzle = emojis needed (2-6), 0 = missed
    res := jsonb_build_object('score', pts, 'solved', solved, 'ms', ms,
      'used', (select jsonb_agg(case when t2->>-1 <> '+' and public.dose_emoji_ok(t2->>-1, c->'puzzles'->(i - 1)::int) then jsonb_array_length(t2) + 1 else 0 end)
               from jsonb_array_elements(g) with ordinality e(t2, i)),
      'cats', (select jsonb_agg(p->'cat') from jsonb_array_elements(c->'puzzles') p),
      'answers', (select jsonb_agg(p->'a'->0) from jsonb_array_elements(c->'puzzles') p),
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  end if;
  update public.dose_plays set guesses = g, result = res, finished_at = case when res is not null then now() end, won = case when res is not null then solved > 0 end
    where user_id = uid and game = 'emoji' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'emoji' and day = today;
  return public.dose_emoji_state(c, play);
end $$;

create or replace function public.dose_imposter_state(c jsonb, play public.dose_plays) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('rounds', (select jsonb_agg(case when p is null then jsonb_build_object('names', r->'names')
      else jsonb_build_object('names', r->'names', 'picked', p, 'odd', r->'odd', 'link', r->'link', 'right', p = r->'odd') end order by i)
    from jsonb_array_elements(c->'rounds') with ordinality e(r, i)
    left join lateral (select coalesce(play.guesses, '[]')->(i - 1)::int p) x on true), 'result', play.result)
$$;
revoke all on function public.dose_imposter_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_imposter_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'imposter' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'imposter', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'imposter' and day = today;
  return public.dose_imposter_state(c, play);
end $$;

-- one tap per round, in order
create or replace function public.dose_imposter_pick(p_k int, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today(); c jsonb; play public.dose_plays; g jsonb; n int; pts int; res jsonb; ms int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'imposter' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'imposter' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_imposter_state(c, play); end if;
  g := coalesce(play.guesses, '[]'); n := jsonb_array_length(c->'rounds');
  if p_k is distinct from jsonb_array_length(g) then raise exception 'wrong round' using errcode = '22023'; end if;
  if not (c->'rounds'->p_k->'names') ? coalesce(p_name, '') then raise exception 'not a name' using errcode = '22023'; end if;
  g := g || to_jsonb(p_name);
  if jsonb_array_length(g) = n then
    select count(*) into pts from jsonb_array_elements(c->'rounds') with ordinality e(r, i) where g->(i - 1)::int = r->'odd';
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    select count(*) filter (where (result->>'score')::int < pts or ((result->>'score')::int = pts and (result->>'ms')::int > ms)), count(*)
      into better, total from public.dose_plays where game = 'imposter' and day = today and finished_at is not null;
    res := jsonb_build_object('score', pts, 'ms', ms,
      'right', (select jsonb_agg(g->(i - 1)::int = r->'odd' order by i) from jsonb_array_elements(c->'rounds') with ordinality e(r, i)),
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  end if;
  update public.dose_plays set guesses = g, result = res, finished_at = case when res is not null then now() end, won = case when res is not null then pts > 0 end
    where user_id = uid and game = 'imposter' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'imposter' and day = today;
  return public.dose_imposter_state(c, play);
end $$;

revoke all on function public.dose_emoji_start(), public.dose_emoji_guess(int, text), public.dose_imposter_start(), public.dose_imposter_pick(int, text) from public, anon;
grant execute on function public.dose_emoji_start(), public.dose_emoji_guess(int, text), public.dose_imposter_start(), public.dose_imposter_pick(int, text) to authenticated;
