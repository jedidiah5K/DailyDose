-- Daily Dose, setup 11: Mind Meld gets two choices.
-- Read the room (Herd round): send your answer with a guess of how many people give it: few (<5%),
-- some (5-20%) or lots (>20%). Right = +1 point.
-- I'm sure (once per round): a landed answer scores 2 instead of 1, a miss costs 1.
-- Each guess stores its points (pts); the result adds points (score stays = answers landed). Safe to run twice.

drop function if exists public.dose_meld_answer(text);

create or replace function public.dose_meld_answer(p_text text, p_read text default null, p_sure boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  c jsonb; play public.dose_plays; v_k int; v_round text; v_i int; answers jsonb; aid text; late boolean;
  herd_total int; v_share numeric; v_rank int; mark text; g jsonb; said int; said_total int; v_top jsonb; res jsonb;
  v_sure boolean; v_band text; v_read_ok boolean; v_pts int;
  K constant int := 40;   -- how much weight the starting estimates carry against real answers
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if length(coalesce(p_text, '')) > 40 then raise exception 'too long' using errcode = '22023'; end if;
  if p_read is not null and p_read not in ('few', 'some', 'lots') then raise exception 'bad read' using errcode = '22023'; end if;
  select content into c from public.dose_puzzles where game = 'meld' and day = today and status = 'live';
  select * into play from public.dose_plays where user_id = uid and game = 'meld' and day = today for update;
  if c is null or play.user_id is null then raise exception 'start first' using errcode = 'P0002'; end if;
  if play.finished_at is not null then raise exception 'already finished' using errcode = 'P0001'; end if;
  v_k := jsonb_array_length(play.guesses); v_round := case when v_k < 5 then 'herd' else 'odd' end; v_i := v_k % 5;
  if play.result->'served'->>'k' is distinct from v_k::text then raise exception 'not served' using errcode = 'P0001'; end if;
  late := now() - (play.result->'served'->>'at')::timestamptz > interval '22 seconds';   -- 2s grace for slow networks
  answers := c->'prompts'->v_i->'answers';
  aid := case when late then null else public.dose_meld_match(answers, p_text) end;
  -- one "I'm sure" per round; a second one is quietly ignored
  v_sure := coalesce(p_sure, false) and not exists (
    select 1 from jsonb_array_elements(play.guesses) x where x->>'r' = v_round and (x->>'sure')::boolean);

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

  -- points: 1 for landing (2 if sure), -1 for a sure miss, +1 for reading the room right
  v_band := case when v_share is null then null when v_share < 5 then 'few' when v_share <= 20 then 'some' else 'lots' end;
  v_read_ok := case when v_round = 'herd' and p_read is not null and aid is not null then p_read = v_band end;
  v_pts := case when mark in ('g', 'p') then case when v_sure then 2 else 1 end when v_sure then -1 else 0 end
         + case when v_read_ok then 1 else 0 end;

  g := jsonb_build_object('r', v_round, 'i', v_i, 't', left(coalesce(p_text, ''), 40), 'a', aid,
    'label', (select a->>1 from jsonb_array_elements(answers) a where a->>0 = aid), 'mark', mark,
    'share', round(v_share, 1), 'said', said, 'of', said_total, 'late', late, 'top', v_top,
    'sure', v_sure, 'read', case when v_round = 'herd' then p_read end, 'band', v_band, 'read_ok', v_read_ok, 'pts', v_pts);

  if v_k + 1 = 10 then
    select jsonb_build_object(
      'herd', string_agg(x->>'mark', '' order by o) filter (where x->>'r' = 'herd'),
      'odd', string_agg(x->>'mark', '' order by o) filter (where x->>'r' = 'odd'),
      'score', count(*) filter (where x->>'mark' in ('g', 'p')),
      'points', coalesce(sum((x->>'pts')::int), 0),
      'reads', count(*) filter (where (x->>'read_ok')::boolean))
      into res from jsonb_array_elements(play.guesses || jsonb_build_array(g)) with ordinality e(x, o);
  end if;
  update public.dose_plays set guesses = guesses || jsonb_build_array(g),
    result = coalesce(res, '{}'::jsonb), finished_at = case when res is not null then now() end, won = case when res is not null then true end
  where user_id = uid and game = 'meld' and day = today;
  return g || jsonb_build_object('result', res);
end $$;

revoke all on function public.dose_meld_answer(text, text, boolean) from public, anon;
grant execute on function public.dose_meld_answer(text, text, boolean) to authenticated;
