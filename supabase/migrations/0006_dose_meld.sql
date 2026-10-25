-- Daily Dose, setup 6: Mind Meld (world mode). Five prompts, answered twice: a Herd round (say what most
-- people say) then an Odd round (say something real that few people say). 20 seconds a prompt, timed here.
-- content = {"prompts":[{"q", "answers":[[id, label, [aliases], est%], ...]}]}. Safe to run twice.

create extension if not exists fuzzystrmatch with schema extensions;

-- How many people gave each curated answer, per prompt and round. Only curated answers are counted;
-- free text never leaves the player's own row.
create table if not exists public.dose_meld_counts (
  day date not null, i int not null, round text not null check (round in ('herd', 'odd')),
  answer_id text not null, n int not null default 0,
  primary key (day, i, round, answer_id)
);
alter table public.dose_meld_counts enable row level security;

create or replace function public.dose_meld_norm(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9& ]', '', 'g'), '\s+', ' ', 'g'));
$$;

-- Match free text to a curated answer: exact (ignoring a plural s), else close enough for a typo.
create or replace function public.dose_meld_match(p_answers jsonb, p_text text) returns text
language plpgsql immutable set search_path = '' as $$
declare n text := public.dose_meld_norm(p_text); a jsonb; c text; cn text; best text; best_d int := 99; d int; tol int;
begin
  if length(n) = 0 then return null; end if;
  for a in select * from jsonb_array_elements(p_answers) loop
    for c in select a->>0 union all select a->>1 union all select jsonb_array_elements_text(a->2) loop
      cn := public.dose_meld_norm(c);
      if cn = n or regexp_replace(cn, 'e?s$', '') = regexp_replace(n, 'e?s$', '') then return a->>0; end if;
      -- short words need an exact match (pray is not gray); longer ones forgive a typo or two
      tol := case when length(cn) >= 9 then 2 when length(cn) >= 5 then 1 else 0 end;
      d := extensions.levenshtein(n, cn);
      if d <= tol and d < best_d then best := a->>0; best_d := d; end if;
    end loop;
  end loop;
  return best;
end $$;

create or replace function public.dose_meld_start() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; c jsonb; play public.dose_plays;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select content into c from public.dose_puzzles where game = 'meld' and day = today and status = 'live';
  if c is null then raise exception 'no puzzle today' using errcode = 'P0002'; end if;
  insert into public.dose_plays (user_id, game, day) values (uid, 'meld', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'meld' and day = today;
  return jsonb_build_object('prompts', (select jsonb_agg(p->'q' order by o) from jsonb_array_elements(c->'prompts') with ordinality e(p, o)),
    'guesses', play.guesses, 'result', case when play.finished_at is not null then play.result end);
end $$;

-- Show the next prompt and start its 20-second clock (asking again keeps the first time).
create or replace function public.dose_meld_serve() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; play public.dose_plays; k int; r text; i int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into play from public.dose_plays where user_id = uid and game = 'meld' and day = today for update;
  if play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  k := jsonb_array_length(play.guesses); r := case when k < 5 then 'herd' else 'odd' end; i := k % 5;
  if play.result->'served'->>'k' is distinct from k::text then
    update public.dose_plays set result = jsonb_build_object('served', jsonb_build_object('k', k, 'at', now()))
    where user_id = uid and game = 'meld' and day = today;
    return jsonb_build_object('round', r, 'i', i, 'left_ms', 20000);
  end if;
  return jsonb_build_object('round', r, 'i', i, 'left_ms', greatest(0, 20000 - floor(extract(epoch from now() - (play.result->'served'->>'at')::timestamptz) * 1000)));
end $$;

create or replace function public.dose_meld_answer(p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; v_k int; v_round text; v_i int; answers jsonb; aid text; late boolean;
  herd_total int; v_share numeric; v_rank int; mark text; g jsonb; said int; said_total int; v_top jsonb; res jsonb;
  K constant int := 40;   -- how much weight the starting estimates carry against real answers
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if length(coalesce(p_text, '')) > 40 then raise exception 'too long' using errcode = '22023'; end if;
  select content into c from public.dose_puzzles where game = 'meld' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'meld' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  v_k := jsonb_array_length(play.guesses); v_round := case when v_k < 5 then 'herd' else 'odd' end; v_i := v_k % 5;
  if play.result->'served'->>'k' is distinct from v_k::text then raise exception 'not served' using errcode = 'P0001'; end if;
  late := now() - (play.result->'served'->>'at')::timestamptz > interval '22 seconds';   -- 2s grace for slow networks
  answers := c->'prompts'->v_i->'answers';
  aid := case when late then null else public.dose_meld_match(answers, p_text) end;

  if aid is not null then
    insert into public.dose_meld_counts (day, i, round, answer_id, n) values (today, v_i, v_round, aid, 1)
      on conflict (day, i, round, answer_id) do update set n = public.dose_meld_counts.n + 1;
  end if;

  -- popularity: starting estimates blended with real Herd answers
  select coalesce(sum(n), 0) into herd_total from public.dose_meld_counts where day = today and dose_meld_counts.i = v_i and round = 'herd';
  with pop as (
    select a->>0 as id, a->>1 as label,
      ((select coalesce(max(m.n), 0) from public.dose_meld_counts m where m.day = today and m.i = v_i and m.round = 'herd' and m.answer_id = a->>0)
        + (a->>3)::numeric * K / 100) / (herd_total + K) * 100 as share
    from jsonb_array_elements(answers) a)
  select (select p.share from pop p where p.id = aid),
         (select count(*) + 1 from pop p, pop me where me.id = aid and p.share > me.share),
         (select jsonb_agg(jsonb_build_object('label', label, 'share', round(share, 1)) order by share desc) from (select * from pop order by share desc limit 3) t)
    into v_share, v_rank, v_top;

  mark := case when aid is null then 'x'
               when v_round = 'herd' then case when v_rank <= 3 then 'g' else 'y' end
               else case when v_share < 4 then 'p' else 'c' end end;
  select coalesce(max(n), 0) into said from public.dose_meld_counts where day = today and dose_meld_counts.i = v_i and round = v_round and answer_id = aid;
  select coalesce(sum(n), 0) into said_total from public.dose_meld_counts where day = today and dose_meld_counts.i = v_i and round = v_round;

  g := jsonb_build_object('r', v_round, 'i', v_i, 't', left(coalesce(p_text, ''), 40), 'a', aid,
    'label', (select a->>1 from jsonb_array_elements(answers) a where a->>0 = aid), 'mark', mark,
    'share', round(v_share, 1), 'said', said, 'of', said_total, 'late', late, 'top', v_top);

  if v_k + 1 = 10 then
    select jsonb_build_object(
      'herd', string_agg(x->>'mark', '' order by o) filter (where x->>'r' = 'herd'),
      'odd', string_agg(x->>'mark', '' order by o) filter (where x->>'r' = 'odd'),
      'score', count(*) filter (where x->>'mark' in ('g', 'p')))
      into res from jsonb_array_elements(play.guesses || jsonb_build_array(g)) with ordinality e(x, o);
  end if;
  update public.dose_plays set guesses = guesses || jsonb_build_array(g),
    result = coalesce(res, '{}'::jsonb), finished_at = case when res is not null then now() end, won = case when res is not null then true end
  where user_id = uid and game = 'meld' and day = today;
  return g || jsonb_build_object('result', res);
end $$;

revoke all on function public.dose_meld_start() from public, anon;
revoke all on function public.dose_meld_serve() from public, anon;
revoke all on function public.dose_meld_answer(text) from public, anon;
grant execute on function public.dose_meld_start() to authenticated;
grant execute on function public.dose_meld_serve() to authenticated;
grant execute on function public.dose_meld_answer(text) to authenticated;
