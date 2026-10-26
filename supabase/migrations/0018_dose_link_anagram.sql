-- Daily Dose, setup 18: Missing Link and Anagram (they replace Cipher). Safe to run twice.
-- Missing Link: five links a day. Each shows three clue words; the hidden word goes with all three
--   (SUN, MOON, CANDLE -> LIGHT). Three tries per link: 3 points first try, 2 second, 1 third.
--   content = {"links": [{"clues": [..3], "answer": "light", "also": ["..."]}, ...5]}
--   play.guesses = one array of guesses per link reached: [["lamp", "light"], ["ball"], ...]
-- Anagram: five scrambled words, short to long. Unscramble them all; skipping costs the word.
--   content = {"words": [..5], "scrambles": [..5], "also": [[..], ..]}   (also: other spellings we accept)
--   play.guesses = one outcome per word finished: ["ok", "skip", ...]
-- Answers never leave the server before that link/word is finished.

alter table public.dose_plays drop constraint if exists dose_plays_game_check;
alter table public.dose_plays add constraint dose_plays_game_check check (game in
  ('vault', 'rewire', 'hunch', 'drop', 'meld', 'last', 'tangle', 'cipher', 'ladder', 'link', 'anagram', 'bluff', 'zoom', 'echo'));

-- Friends see each other's results, never the answers inside them (Ladder's path, today's links and words).
create or replace function public.dose_friends_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
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

-- ---------- Missing Link ----------
-- A guess counts if it is the answer, one of the accepted spellings, or a plural/singular of either.
create or replace function public.dose_link_ok(p_guess text, p_link jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select exists (
    select 1 from (select p_link->>'answer' as a union all select jsonb_array_elements_text(coalesce(p_link->'also', '[]'))) x
    where p_guess in (x.a, x.a || 's', x.a || 'es') or x.a in (p_guess || 's', p_guess || 'es'))
$$;

create or replace function public.dose_link_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := coalesce(play.guesses, '[]'); n int := jsonb_array_length(c->'links'); out jsonb := '[]'; k int; tries jsonb; fin boolean; ok boolean;
begin
  for k in 0..n - 1 loop
    tries := coalesce(g->k, '[]');
    ok := jsonb_array_length(tries) > 0 and public.dose_link_ok(tries->>-1, c->'links'->k);
    fin := ok or jsonb_array_length(tries) >= 3 or coalesce(tries->>-1 = '?', false);
    out := out || jsonb_build_object('clues', c->'links'->k->'clues', 'tries', tries - '?', 'done', fin, 'solved', ok,
      'answer', case when fin then c->'links'->k->>'answer' end);
    exit when not fin;   -- links after the current one stay hidden
  end loop;
  return jsonb_build_object('n', n, 'links', out, 'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result);
end $$;
revoke all on function public.dose_link_state(jsonb, public.dose_plays) from public, anon, authenticated;
revoke all on function public.dose_link_ok(text, jsonb) from public, anon, authenticated;

create or replace function public.dose_link_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'link' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'link', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today;
  return public.dose_link_state(c, play);
end $$;

-- p_guess: a guess for the current link, or '?' to give that link up.
create or replace function public.dose_link_guess(p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; g jsonb; k int := 0; n int; tries jsonb; w text; pts int := 0; solved int := 0; res jsonb; ms int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'link' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_link_state(c, play); end if;
  w := case when trim(coalesce(p_guess, '')) = '?' then '?' else regexp_replace(lower(coalesce(p_guess, '')), '[^a-z]', '', 'g') end;
  if w = '' or length(w) > 20 then raise exception 'type a word' using errcode = '22023'; end if;
  g := coalesce(play.guesses, '[]'); n := jsonb_array_length(c->'links');
  -- the current link: the first one not finished
  loop
    tries := coalesce(g->k, '[]');
    exit when not (jsonb_array_length(tries) > 0 and (public.dose_link_ok(tries->>-1, c->'links'->k) or jsonb_array_length(tries) >= 3 or tries->>-1 = '?'));
    k := k + 1;
  end loop;
  if w <> '?' and tries ? w then raise exception 'already tried' using errcode = '22023'; end if;
  tries := tries || to_jsonb(w);
  g := case when k < jsonb_array_length(g) then jsonb_set(g, array[k::text], tries) else g || jsonb_build_array(tries) end;
  -- finished the last link? score it
  if k = n - 1 and (public.dose_link_ok(w, c->'links'->k) or jsonb_array_length(tries) >= 3 or w = '?') then
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    for k in 0..n - 1 loop
      tries := g->k;
      if public.dose_link_ok(tries->>-1, c->'links'->k) then solved := solved + 1; pts := pts + 4 - jsonb_array_length(tries); end if;
    end loop;
    select count(*) filter (where (result->>'score')::int < pts or ((result->>'score')::int = pts and (result->>'ms')::int > ms)), count(*)
      into better, total from public.dose_plays where game = 'link' and day = today and finished_at is not null;
    res := jsonb_build_object('score', pts, 'solved', solved, 'ms', ms,
      'tries', (select jsonb_agg(case when public.dose_link_ok(t->>-1, c->'links'->(i - 1)::int) then jsonb_array_length(t) else 0 end) from jsonb_array_elements(g) with ordinality as e(t, i)),
      'answers', (select jsonb_agg(l->'answer') from jsonb_array_elements(c->'links') l),
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  end if;
  update public.dose_plays set guesses = g, result = res, finished_at = case when res is not null then now() end, won = case when res is not null then solved > 0 end
    where user_id = uid and game = 'link' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today;
  return public.dose_link_state(c, play);
end $$;

-- ---------- Anagram ----------
create or replace function public.dose_anagram_state(c jsonb, play public.dose_plays) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('n', jsonb_array_length(c->'words'), 'scrambles', c->'scrambles', 'outcomes', coalesce(play.guesses, '[]'),
    'revealed', (select coalesce(jsonb_agg(c->'words'->(i::int - 1)), '[]') from jsonb_array_elements(coalesce(play.guesses, '[]')) with ordinality e(o, i)),
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result)
$$;
revoke all on function public.dose_anagram_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_anagram_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'anagram' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'anagram', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'anagram' and day = today;
  return public.dose_anagram_state(c, play);
end $$;

-- p_guess: the current word, or '?' to skip it. A wrong word is an error and costs nothing but time.
create or replace function public.dose_anagram_guess(p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
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
  else raise exception 'not it' using errcode = '22023';
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

revoke all on function public.dose_link_start() from public, anon;
revoke all on function public.dose_link_guess(text) from public, anon;
revoke all on function public.dose_anagram_start() from public, anon;
revoke all on function public.dose_anagram_guess(text) from public, anon;
grant execute on function public.dose_link_start() to authenticated;
grant execute on function public.dose_link_guess(text) to authenticated;
grant execute on function public.dose_anagram_start() to authenticated;
grant execute on function public.dose_anagram_guess(text) to authenticated;
