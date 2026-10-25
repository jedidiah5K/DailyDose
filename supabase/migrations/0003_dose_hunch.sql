-- Daily Dose, setup 3: Hunch. Five estimates a day; answers stay on the server until you lock in a guess.
-- content = {"questions":[{"q","unit","min","max","log","answer","source"}]}. Safe to run twice.

-- Today's questions without the answers, plus anything already guessed (answers included for those).
create or replace function public.dose_hunch_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'hunch' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'hunch', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'hunch' and day = today;
  return jsonb_build_object(
    'questions', (select jsonb_agg(q - 'answer' - 'source' order by o) from jsonb_array_elements(c->'questions') with ordinality e(q, o)),
    'guesses', play.guesses, 'result', play.result);
end $$;
revoke all on function public.dose_hunch_start() from public, anon;
grant execute on function public.dose_hunch_start() to authenticated;

-- Lock in a guess for question p_i (in order, once each). Returns the answer and the world's guesses.
create or replace function public.dose_hunch_guess(p_i int, p_v numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  c jsonb; q jsonb; play public.dose_plays;
  lo numeric; hi numeric; a numeric; islog boolean;
  err numeric; others numeric[]; w_avg numeric; bins int[]; b int; v numeric;
  g jsonb; done boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'hunch' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'hunch' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if p_i is distinct from jsonb_array_length(play.guesses) or p_i >= jsonb_array_length(c->'questions') then
    raise exception 'wrong question' using errcode = '22023';
  end if;
  q := c->'questions'->p_i;
  lo := (q->>'min')::numeric; hi := (q->>'max')::numeric; a := (q->>'answer')::numeric; islog := coalesce((q->>'log')::boolean, false);
  if p_v is null or p_v < lo or p_v > hi then raise exception 'out of range' using errcode = '22023'; end if;

  -- years: % of the slider's range, so 2005 vs 2007 isn't "0% off"; everything else: % of the answer
  err := round(case when coalesce(q->>'unit', '') = '' and lo >= 1000 then abs(p_v - a) / (hi - lo) else abs(p_v - a) / a end * 100, 1);

  -- everyone else's guess for this question today
  -- ponytail: scans today's plays on each guess; fine for thousands of players, add a stats table past that
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
    'beat', case when w_avg is not null then abs(p_v - a) < abs(w_avg - a) end, 'source', q->'source');
  done := p_i + 1 = jsonb_array_length(c->'questions');
  update public.dose_plays set guesses = guesses || jsonb_build_array(g),
    finished_at = case when done then now() end, won = case when done then true end,
    result = case when done then jsonb_build_object(
      'err', (select round(avg((x->>'err')::numeric), 1) from jsonb_array_elements(guesses || jsonb_build_array(g)) x),
      'beat', (select count(*) from jsonb_array_elements(guesses || jsonb_build_array(g)) x where (x->>'beat')::boolean),
      'rated', (select count(*) from jsonb_array_elements(guesses || jsonb_build_array(g)) x where x->>'beat' is not null)) end
  where user_id = uid and game = 'hunch' and day = today
  returning result into c;
  return g || jsonb_build_object('result', c);
end $$;
revoke all on function public.dose_hunch_guess(int, numeric) from public, anon;
grant execute on function public.dose_hunch_guess(int, numeric) to authenticated;
