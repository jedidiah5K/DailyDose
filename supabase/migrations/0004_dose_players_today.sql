-- Daily Dose, setup 4: how many people played anything today (a single number, no names).
-- Open to visitors who haven't played yet, so opening the app doesn't create an account.
create or replace function public.dose_players_today() returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct user_id)::int from public.dose_plays where day = (now() at time zone 'utc')::date;
$$;
revoke all on function public.dose_players_today() from public;
grant execute on function public.dose_players_today() to anon, authenticated;
