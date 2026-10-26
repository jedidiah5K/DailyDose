-- Daily Dose, setup 20: Missing Link, play the five links in any order (Job, 2026-10-26).
-- All five are open from the start; skip one and come back. Each link keeps its own three tries.
-- Near-miss cues: every link shows its answer's length, and the first letter after two wrong tries.
-- p_k = which link (0..4); p_guess = a word, or '?' to give that link up. Safe to run twice.

create or replace function public.dose_link_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := coalesce(play.guesses, '[]'); n int := jsonb_array_length(c->'links'); out jsonb := '[]'; k int; tries jsonb; fin boolean; ok boolean; a text;
begin
  for k in 0..n - 1 loop
    tries := coalesce(g->k, '[]'); a := c->'links'->k->>'answer';
    ok := jsonb_array_length(tries) > 0 and public.dose_link_ok(tries->>-1, c->'links'->k);
    fin := ok or jsonb_array_length(tries) >= 3 or coalesce(tries->>-1 = '?', false);
    out := out || jsonb_build_object('clues', c->'links'->k->'clues', 'tries', tries - '?', 'done', fin, 'solved', ok, 'len', length(a),
      'hint', case when not fin and jsonb_array_length(tries) >= 2 then upper(left(a, 1)) end,
      'answer', case when fin then a end);
  end loop;
  return jsonb_build_object('n', n, 'links', out, 'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result);
end $$;
revoke all on function public.dose_link_state(jsonb, public.dose_plays) from public, anon, authenticated;

drop function if exists public.dose_link_guess(text);
create or replace function public.dose_link_guess(p_k int, p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
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

  -- every link finished? score it: 3 points first try, 2 second, 1 third
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

revoke all on function public.dose_link_guess(int, text) from public, anon;
grant execute on function public.dose_link_guess(int, text) to authenticated;
