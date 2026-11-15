-- Missing Link, one clue at a time (Job, 2026-11-15).
-- Each link starts with one clue. "Show another clue" ('+') or a wrong guess reveals the next, up to three.
-- Points per link = 4 - clues seen when you solve it (1 clue = 3, 2 = 2, 3 = 1), so a day still scores out of 15.
-- Unseen clues never leave the server. Still three guesses per link; '?' gives a link up. Safe to run twice.

create or replace function public.dose_link_n(tries jsonb, what text) returns int
language sql immutable set search_path = '' as $$
  select count(*)::int from jsonb_array_elements_text(coalesce(tries, '[]')) x
  where case what when '+' then x = '+' else x not in ('+', '?') end
$$;
revoke all on function public.dose_link_n(jsonb, text) from public, anon, authenticated;

-- clues seen so far: the first, one per '+', one per wrong guess (the winning guess doesn't add one)
create or replace function public.dose_link_seen(tries jsonb, ok boolean) returns int
language sql immutable set search_path = '' as $$
  select least(3, 1 + public.dose_link_n(tries, '+') + public.dose_link_n(tries, 'g') - case when ok then 1 else 0 end)
$$;
revoke all on function public.dose_link_seen(jsonb, boolean) from public, anon, authenticated;

create or replace function public.dose_link_state(c jsonb, play public.dose_plays) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g jsonb := coalesce(play.guesses, '[]'); n int := jsonb_array_length(c->'links'); out jsonb := '[]'; k int; tries jsonb; fin boolean; ok boolean; a text; seen int; wrong int;
begin
  for k in 0..n - 1 loop
    tries := coalesce(g->k, '[]'); a := c->'links'->k->>'answer';
    ok := public.dose_link_n(tries, 'g') > 0 and public.dose_link_ok(tries->>-1, c->'links'->k);
    fin := ok or public.dose_link_n(tries, 'g') >= 3 or coalesce(tries->>-1 = '?', false);
    seen := case when fin then 3 else public.dose_link_seen(tries, false) end;
    wrong := public.dose_link_n(tries, 'g') - case when ok then 1 else 0 end;
    out := out || jsonb_build_object(
      'clues', (select jsonb_agg(x order by i) from jsonb_array_elements(c->'links'->k->'clues') with ordinality e(x, i) where i <= seen),
      'more', not fin and seen < 3,
      'used', public.dose_link_seen(tries, ok),
      'tries', tries - '?' - '+', 'done', fin, 'solved', ok, 'len', length(a),
      'hint', case when not fin and wrong >= 2 then upper(left(a, 1)) end,
      'answer', case when fin then a end);
  end loop;
  return jsonb_build_object('n', n, 'links', out, 'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result);
end $$;
revoke all on function public.dose_link_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_link_guess(p_k int, p_guess text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := public.dose_today();
  c jsonb; play public.dose_plays; g jsonb; k int; n int; tries jsonb; w text; pts int := 0; solved int := 0; open int := 0;
  res jsonb; ms int; better int; total int; ok boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'link' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_link_state(c, play); end if;
  n := jsonb_array_length(c->'links');
  if p_k is null or p_k < 0 or p_k >= n then raise exception 'bad link' using errcode = '22023'; end if;
  w := case when trim(coalesce(p_guess, '')) in ('?', '+') then trim(p_guess) else regexp_replace(lower(coalesce(p_guess, '')), '[^a-z]', '', 'g') end;
  if w = '' or length(w) > 20 then raise exception 'type a word' using errcode = '22023'; end if;

  g := coalesce(play.guesses, '[]');
  while jsonb_array_length(g) < n loop g := g || '[[]]'::jsonb; end loop;
  tries := g->p_k;
  if (public.dose_link_n(tries, 'g') > 0 and public.dose_link_ok(tries->>-1, c->'links'->p_k)) or public.dose_link_n(tries, 'g') >= 3 or tries->>-1 = '?' then
    raise exception 'link done' using errcode = '22023';
  end if;
  if w = '+' and public.dose_link_seen(tries, false) >= 3 then raise exception 'no more clues' using errcode = '22023'; end if;
  if w not in ('?', '+') and tries ? w then raise exception 'already tried' using errcode = '22023'; end if;
  g := jsonb_set(g, array[p_k::text], tries || to_jsonb(w));

  for k in 0..n - 1 loop
    tries := g->k;
    ok := public.dose_link_n(tries, 'g') > 0 and public.dose_link_ok(tries->>-1, c->'links'->k);
    if ok then solved := solved + 1; pts := pts + 4 - public.dose_link_seen(tries, true);
    elsif not (public.dose_link_n(tries, 'g') >= 3 or coalesce(tries->>-1 = '?', false)) then open := open + 1;
    end if;
  end loop;
  if open = 0 then
    ms := floor(extract(epoch from now() - play.started_at) * 1000);
    select count(*) filter (where (result->>'score')::int < pts or ((result->>'score')::int = pts and (result->>'ms')::int > ms)), count(*)
      into better, total from public.dose_plays where game = 'link' and day = today and finished_at is not null;
    -- 'tries' per link = clues needed (1-3), 0 = missed
    res := jsonb_build_object('score', pts, 'solved', solved, 'ms', ms,
      'tries', (select jsonb_agg(case when public.dose_link_n(t, 'g') > 0 and public.dose_link_ok(t->>-1, c->'links'->(i - 1)::int) then public.dose_link_seen(t, true) else 0 end)
                from jsonb_array_elements(g) with ordinality as e(t, i)),
      'answers', (select jsonb_agg(l->'answer') from jsonb_array_elements(c->'links') l),
      'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
  end if;
  update public.dose_plays set guesses = g, result = res, finished_at = case when res is not null then now() end, won = case when res is not null then solved > 0 end
    where user_id = uid and game = 'link' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'link' and day = today;
  return public.dose_link_state(c, play);
end $$;
