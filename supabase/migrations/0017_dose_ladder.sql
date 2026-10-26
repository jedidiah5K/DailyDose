-- Daily Dose, setup 17: Ladder. Turn one word into another, one letter at a time; every step must be a
-- real word. Fewest steps wins (par = the shortest possible). The server checks each step against
-- dose_words and keeps the chain. content = {"start", "end", "par", "path"}. Safe to run twice.

create table if not exists public.dose_words (word text primary key check (word ~ '^[a-z]{4}$'));
alter table public.dose_words enable row level security;
revoke all on public.dose_words from anon, authenticated;

create or replace function public.dose_ladder_state(c jsonb, play public.dose_plays) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('start', c->'start', 'end', c->'end', 'par', c->'par',
    'chain', case when jsonb_array_length(play.guesses) > 0 then play.guesses else jsonb_build_array(c->'start') end,
    'elapsed_ms', floor(extract(epoch from now() - play.started_at) * 1000), 'result', play.result)
$$;
revoke all on function public.dose_ladder_state(jsonb, public.dose_plays) from public, anon, authenticated;

create or replace function public.dose_ladder_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'ladder' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'ladder', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'ladder' and day = today;
  return public.dose_ladder_state(c, play);
end $$;

-- p_word: the next rung. 'back' takes the last rung off; 'give up' ends the game and shows a shortest ladder.
create or replace function public.dose_ladder_step(p_word text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; chain jsonb; w text := lower(trim(coalesce(p_word, ''))); last text;
  diff int := 0; i int; res jsonb; ms int; steps int; better int; total int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'ladder' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'ladder' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then return public.dose_ladder_state(c, play); end if;
  chain := case when jsonb_array_length(play.guesses) > 0 then play.guesses else jsonb_build_array(c->'start') end;
  ms := floor(extract(epoch from now() - play.started_at) * 1000);

  if w = 'back' then
    if jsonb_array_length(chain) > 1 then chain := chain - (jsonb_array_length(chain) - 1); end if;
  elsif w = 'give up' then
    res := jsonb_build_object('solved', false, 'par', c->'par', 'path', c->'path', 'ms', ms);
  else
    last := chain->>(jsonb_array_length(chain) - 1);
    if w !~ '^[a-z]{4}$' then raise exception 'four letters' using errcode = '22023'; end if;
    for i in 1..4 loop if substr(w, i, 1) <> substr(last, i, 1) then diff := diff + 1; end if; end loop;
    if diff <> 1 then raise exception 'change one letter' using errcode = '22023'; end if;
    if chain ? w then raise exception 'already used' using errcode = '22023'; end if;
    if not exists (select 1 from public.dose_words where word = w) then raise exception 'not a word' using errcode = '22023'; end if;
    chain := chain || to_jsonb(w);
    if w = c->>'end' then
      steps := jsonb_array_length(chain) - 1;
      select count(*) filter (where not coalesce((result->>'solved')::boolean, false) or (result->>'steps')::int > steps
                                 or ((result->>'steps')::int = steps and (result->>'ms')::int > ms)), count(*)
        into better, total from public.dose_plays where game = 'ladder' and day = today and finished_at is not null;
      res := jsonb_build_object('solved', true, 'steps', steps, 'par', c->'par', 'path', c->'path', 'ms', ms,
        'beat', case when total > 0 then round(100.0 * better / total) end, 'players', total + 1);
    end if;
  end if;
  update public.dose_plays set guesses = chain, result = res, finished_at = case when res is not null then now() end,
    won = case when res is not null then (res->>'solved')::boolean end
    where user_id = uid and game = 'ladder' and day = today;
  select * into play from public.dose_plays where user_id = uid and game = 'ladder' and day = today;
  return public.dose_ladder_state(c, play);
end $$;

revoke all on function public.dose_ladder_start() from public, anon;
revoke all on function public.dose_ladder_step(text) from public, anon;
grant execute on function public.dose_ladder_start() to authenticated;
grant execute on function public.dose_ladder_step(text) to authenticated;
