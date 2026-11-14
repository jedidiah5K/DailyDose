-- Friends see scores only: also strip The Shot's answer, Rush's missed answers and Drop's card chain,
-- so a friend who finished early can't hand you today's answers.
create or replace function public.dose_friends_today()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := public.dose_today();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', p.display_name, 'results',
      coalesce((select jsonb_object_agg(x.game, x.result - 'theme' - 'beat' - 'players' - 'path' - 'answers' - 'words'
                                                  - 'answer' - 'missed' - 'chain' - 'crowd') from public.dose_plays x
                where x.user_id = f.id and x.day = today and x.finished_at is not null), '{}'::jsonb))
      order by p.display_name nulls last)
    from (select case when d.a = uid then d.b else d.a end as id from public.dose_friends d where d.a = uid or d.b = uid) f
    left join public.dose_profiles p on p.id = f.id), '[]'::jsonb);
end $$;
