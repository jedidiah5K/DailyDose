-- Forgive typos in typed answers (The Shot, Blend, Rush): "pikachoo" counts as "pikachu".
-- Allowed slips grow with the word: none under 4 letters, 1 for 4-5, 2 from 6. Numbers must be exact.
create or replace function public.dose_typo_ok(answer text, typed text) returns boolean
language sql immutable set search_path = '' as $$
  select answer !~ '[0-9]' and length(a) >= 4
     and extensions.levenshtein(a, t) <= case when length(a) >= 6 then 2 else 1 end
  from (select replace(answer, ' ', '') a, replace(typed, ' ', '') t) s
$$;
revoke all on function public.dose_typo_ok(text, text) from public, anon, authenticated;

-- Blend/Rush: exact matches first (as before); then the one closest listed answer or alias, if it's close enough.
-- Two different answers equally close = too ambiguous, so it doesn't count.
create or replace function public.dose_blend_norm(pr jsonb, raw text) returns text
language plpgsql immutable set search_path = '' as $$
declare w text := btrim(regexp_replace(regexp_replace(lower(coalesce(raw, '')), '[^a-z ]', '', 'g'), '\s+', ' ', 'g')); t text; v text; vs text[];
begin
  if w = '' or length(w) > 30 then return null; end if;
  w := regexp_replace(w, '^(the|a|an) ', '');
  vs := array[w, regexp_replace(w, 'ies$', 'y'), regexp_replace(w, 'es$', ''), regexp_replace(w, 's$', '')];
  if pr ? 'drop' then
    v := regexp_replace(w, '^' || (pr->>'drop') || ' ?', '');
    if v <> '' then vs := vs || array[v, regexp_replace(v, 's$', '')]; end if;
  end if;
  foreach t in array vs loop
    if pr->'answers' ? t then return t; end if;
    if coalesce(pr->'alias', '{}') ? t then return pr->'alias'->>t; end if;
  end loop;
  select o.key into v from jsonb_object_keys(pr->'answers') as o(key)
    where replace(o.key, ' ', '') in (select replace(x, ' ', '') from unnest(vs) x) limit 1;
  if v is not null then return v; end if;
  select o.value into v from jsonb_each_text(coalesce(pr->'alias', '{}')) as o
    where replace(o.key, ' ', '') in (select replace(x, ' ', '') from unnest(vs) x) limit 1;
  if v is not null then return v; end if;
  -- typos
  with c as (
    select k.key target, k.key spelled from jsonb_object_keys(pr->'answers') k(key)
    union all select a.value, a.key from jsonb_each_text(coalesce(pr->'alias', '{}')) a),
  near as (
    select target, min(extensions.levenshtein(replace(spelled, ' ', ''), replace(x, ' ', ''))) d
    from c, unnest(vs) x where public.dose_typo_ok(spelled, x) group by target),
  best as (select * from near where d = (select min(d) from near))
  select case when count(*) = 1 then min(target) end into v from best;
  return v;
end $$;
revoke all on function public.dose_blend_norm(jsonb, text) from public, anon, authenticated;

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
          where replace(x, ' ', '') in (replace(w, ' ', ''), regexp_replace(replace(w, ' ', ''), 's$', ''))
             or public.dose_typo_ok(x, w));
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
