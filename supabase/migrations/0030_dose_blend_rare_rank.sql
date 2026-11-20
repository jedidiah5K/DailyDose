-- Blend: "Think like no one" scored by rank, not by size next to the top answer (Job, 2026-11-21, after a
-- playtest where any obscure real answer scored 95-100 and everyone tied near 500).
-- rank = share of the prompt's answers that are more common than yours: the rarest real answer gets 100,
-- a middle-of-the-pack answer about 50, a common one 10. The 💎 goes only to the rarest tenth.
-- "Think like everyone" is unchanged (matching the crowd's top answer is that mode's point).
create or replace function public.dose_blend_score(p_day date, p_k integer, pr jsonb, ans text) returns jsonb
language sql stable set search_path = '' as $$
  with e as (
    select a.key as a, a.value::numeric * 0.5 + coalesce(c.n, 0) as w
    from jsonb_each_text(pr->'answers') a
    left join public.dose_blend_counts c on c.day = p_day and c.k = p_k and c.answer = a.key)
  select jsonb_build_object(
    'share', round(100 * (select w from e where a = ans) / nullif((select sum(w) from e), 0), 1),
    'p', (select w from e where a = ans) / nullif((select max(w) from e), 0),
    'rank', (select count(*) from e where w > (select w from e where a = ans))::numeric / nullif((select count(*) - 1 from e), 0),
    'top', (select jsonb_agg(jsonb_build_array(t.a, round(100 * t.w / (select sum(w) from e)))) from (select * from e order by w desc, a limit 3) t))
$$;
revoke all on function public.dose_blend_score(date, integer, jsonb, text) from public, anon, authenticated;

create or replace function public.dose_blend_answer(p_k integer, p_text text) returns jsonb
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
  sc := public.dose_blend_score(today, p_k, pr, coalesce(a, ''));
  if a is not null then
    insert into public.dose_blend_counts as t (day, k, answer, n) values (today, p_k, a, 1)
      on conflict (day, k, answer) do update set n = t.n + 1;
  end if;
  if a is not null then
    pts := case when pr->>'mode' = 'rare' then greatest(10, round(100 * coalesce((sc->>'rank')::numeric, 1)))
                else greatest(5, round(100 * (sc->>'p')::numeric)) end;
  end if;
  x := x || jsonb_build_object('r', left(btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z ]', '', 'g')), 30),
    'a', a, 'p', pts, 's', sc->'share', 'top', sc->'top', 'late', late,
    'gem', a is not null and pr->>'mode' = 'rare' and coalesce((sc->>'rank')::numeric, 1) >= 0.9);
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
