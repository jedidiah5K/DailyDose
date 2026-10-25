-- Daily Dose, setup 9: Hunch bets. With each guess you pick a band: tight (100 pts), medium (50) or wide (20).
-- Points only if the answer lands inside your band, more the closer it is to your guess.
-- Once a day you can double down: double points if inside, minus 30 if not.
-- A day can have a hidden "theme" in its content; it is only revealed once you finish. Safe to run twice.

create or replace function public.dose_hunch_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
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
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
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

  -- your band around your guess, and how far inside it the answer landed (0 = dead centre, 1 = edge)
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
revoke all on function public.dose_hunch_bet(int, numeric, int, boolean) from public, anon;
grant execute on function public.dose_hunch_bet(int, numeric, int, boolean) to authenticated;
