-- Daily Dose, setup 16: Cipher. A quote with every letter swapped for another. Pick a scrambled letter
-- and say what it stands for; the server checks each guess. 5 wrong guesses and the quote is shown.
-- content = {"text": "THE QUOTE.", "by": "who said it", "key": 26 letters (key[i] stands for letter i), "given": ["E", ...]}
-- The phone only ever gets the scrambled text, the free letters and its own guesses. Safe to run twice.

create or replace function public.dose_cipher_state(c jsonb, play public.dose_plays) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'cipher', translate(c->>'text', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', c->>'key'),
    'given', (select coalesce(jsonb_agg(jsonb_build_object('c', substr(c->>'key', ascii(g) - 64, 1), 'p', g)), '[]') from jsonb_array_elements_text(c->'given') g),
    'tries', play.guesses,
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000),
    'result', play.result)
$$;
revoke all on function public.dose_cipher_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_cipher_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'cipher' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'cipher', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'cipher' and day = today;
  return public.dose_cipher_state(c, play);
end $$;

-- One guess: scrambled letter p_c stands for real letter p_p.
create or replace function public.dose_cipher_guess(p_c text, p_p text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; cipher text; ok boolean; tries jsonb; misses int;
  solved text[]; needed text[]; res jsonb; ms int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_c !~ '^[A-Z]$' or p_p !~ '^[A-Z]$' then raise exception 'bad guess' using errcode = '22023'; end if;
  select content into c from public.dose_puzzles where game = 'cipher' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'cipher' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return jsonb_build_object('result', play.result); end if;
  cipher := translate(c->>'text', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', c->>'key');
  solved := array(select jsonb_array_elements_text(c->'given'))
         || array(select t->>'p' from jsonb_array_elements(play.guesses) t where (t->>'ok')::boolean);
  if position(p_c in cipher) = 0 then raise exception 'not in the quote' using errcode = '22023'; end if;
  -- already worked out (or given): nothing to do
  if p_p = any(solved) or exists (select 1 from unnest(solved) s where substr(c->>'key', ascii(s) - 64, 1) = p_c) then
    return public.dose_cipher_state(c, play);
  end if;
  ok := substr(c->>'key', ascii(p_p) - 64, 1) = p_c;
  tries := play.guesses || jsonb_build_array(jsonb_build_object('c', p_c, 'p', p_p, 'ok', ok));
  misses := (select count(*) from jsonb_array_elements(tries) t where not (t->>'ok')::boolean);
  if ok then solved := solved || p_p; end if;
  needed := array(select distinct ch from regexp_split_to_table(regexp_replace(c->>'text', '[^A-Z]', '', 'g'), '') ch);
  if needed <@ solved or misses >= 5 then
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    if needed <@ solved then
      select count(*) filter (where not coalesce((result->>'solved')::boolean, false) or (result->>'misses')::int > misses
                                 or ((result->>'misses')::int = misses and (result->>'ms')::int > ms)), count(*)
        into better, total from public.dose_plays where game = 'cipher' and day = today and finished_at is not null;
    end if;
    res := jsonb_build_object('solved', needed <@ solved, 'misses', misses, 'ms', ms, 'text', c->>'text', 'by', c->>'by',
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', coalesce(total, 0) + 1);
  end if;
  update public.dose_plays set guesses = tries, result = res, finished_at = case when res is not null then now() end,
    won = case when res is not null then needed <@ solved end
    where user_id = uid and game = 'cipher' and day = today;
  return jsonb_build_object('ok', ok, 'c', p_c, 'p', p_p, 'misses', misses, 'result', res);
end $$;

revoke all on function public.dose_cipher_start() from public, anon;
revoke all on function public.dose_cipher_guess(text, text) from public, anon;
grant execute on function public.dose_cipher_start() to authenticated;
grant execute on function public.dose_cipher_guess(text, text) to authenticated;

-- Tangle: a finished board comes back too, so another phone shows it as it was left.
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
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result,
    'board', case when play.finished_at is not null then play.guesses end);
end $$;
