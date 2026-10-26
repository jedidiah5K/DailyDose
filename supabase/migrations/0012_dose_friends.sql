-- Daily Dose, setup 12: names and friends. Everyone has a friend code (like KX7P M2QD); typing a
-- friend's code makes you friends both ways. Friends see each other's name and tonight's results,
-- nothing else. Code tries are logged and capped at 10 an hour, so codes can't be guessed.
-- Safe to run twice.

-- A small security log (only code tries for now). Rows older than a day are cleared as people play.
create table if not exists public.dose_security_events (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists dose_security_events_user on public.dose_security_events (user_id, kind, created_at);
alter table public.dose_security_events enable row level security;
revoke all on public.dose_security_events from anon, authenticated;

-- 8 characters from 32 (no I, O, 0 or 1), easy to read out: about a trillion possible codes.
create or replace function public.dose_new_code() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(x.b, i) % 32), 1), '' order by i)
  from (select extensions.gen_random_bytes(8) as b) x, generate_series(0, 7) i
$$;
revoke all on function public.dose_new_code() from public, anon, authenticated;

alter table public.dose_profiles add column if not exists friend_code text unique;
-- Names change only through dose_set_name (checked there); you can still read your own row.
drop policy if exists "own profile" on public.dose_profiles;
drop policy if exists "read own profile" on public.dose_profiles;
create policy "read own profile" on public.dose_profiles for select to authenticated using (id = (select auth.uid()));
revoke all on public.dose_profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.dose_profiles from authenticated;

-- One row per friendship, smaller id first.
create table if not exists public.dose_friends (
  a uuid not null references auth.users on delete cascade,
  b uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists dose_friends_b on public.dose_friends (b);
alter table public.dose_friends enable row level security;
revoke all on public.dose_friends from anon, authenticated;

-- My name, my friend code (made the first time) and how many friends I have.
create or replace function public.dose_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.dose_profiles;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.dose_profiles (id) values (uid) on conflict (id) do nothing;
  update public.dose_profiles set friend_code = public.dose_new_code() where id = uid and friend_code is null;
  select * into p from public.dose_profiles where id = uid;
  return jsonb_build_object('name', p.display_name, 'code', p.friend_code,
    'friends', (select count(*) from public.dose_friends where a = uid or b = uid));
end $$;

-- The name friends see: 1 to 20 characters. No control or invisible characters, no angle brackets
-- (the app escapes names too).
create or replace function public.dose_set_name(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := regexp_replace(trim(left(coalesce(p_name, ''), 100)), '\s+', ' ', 'g');
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if char_length(n) not between 1 and 20 or n ~ '[[:cntrl:]<>​-‏‪-‮⁠-⁩﻿]' then
    raise exception 'bad name' using errcode = '22023';
  end if;
  insert into public.dose_profiles (id, display_name) values (uid, n)
    on conflict (id) do update set display_name = excluded.display_name;
  return n;
end $$;

-- Add a friend by their code (spaces, dashes and case don't matter). Wrong codes return instead of
-- raising, so the logged try is kept and counts toward the 10 an hour.
create or replace function public.dose_friend_add(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c text := upper(regexp_replace(left(coalesce(p_code, ''), 40), '[^A-Za-z0-9]', '', 'g'));
  f public.dose_profiles; tries int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.dose_security_events where user_id = uid and created_at < now() - interval '1 day';
  select count(*) into tries from public.dose_security_events
    where user_id = uid and kind = 'friend_try' and created_at > now() - interval '1 hour';
  if tries >= 10 then return jsonb_build_object('ok', false, 'why', 'tries'); end if;
  insert into public.dose_security_events (user_id, kind) values (uid, 'friend_try');
  if char_length(c) = 8 then select * into f from public.dose_profiles where friend_code = c; end if;
  if f.id is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  if f.id = uid then return jsonb_build_object('ok', false, 'why', 'self'); end if;
  if exists (select 1 from public.dose_friends where a = least(uid, f.id) and b = greatest(uid, f.id)) then
    return jsonb_build_object('ok', true, 'already', true, 'name', f.display_name);
  end if;
  if (select count(*) from public.dose_friends where a = uid or b = uid) >= 100
     or (select count(*) from public.dose_friends where a = f.id or b = f.id) >= 100 then
    return jsonb_build_object('ok', false, 'why', 'full');
  end if;
  insert into public.dose_profiles (id) values (uid) on conflict (id) do nothing;
  insert into public.dose_friends (a, b) values (least(uid, f.id), greatest(uid, f.id)) on conflict do nothing;
  return jsonb_build_object('ok', true, 'name', f.display_name);
end $$;

create or replace function public.dose_friend_remove(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.dose_friends where a = least(uid, p_id) and b = greatest(uid, p_id);
end $$;

-- My friends with their name and tonight's finished results: scores only, never answers or guesses,
-- and no Hunch theme (a surprise until you finish).
create or replace function public.dose_friends_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', p.display_name, 'results',
      coalesce((select jsonb_object_agg(x.game, x.result - 'theme' - 'beat' - 'players') from public.dose_plays x
                where x.user_id = f.id and x.day = today and x.finished_at is not null), '{}'::jsonb))
      order by p.display_name nulls last)
    from (select case when d.a = uid then d.b else d.a end as id from public.dose_friends d where d.a = uid or d.b = uid) f
    left join public.dose_profiles p on p.id = f.id), '[]'::jsonb);
end $$;

revoke all on function public.dose_me() from public, anon;
revoke all on function public.dose_set_name(text) from public, anon;
revoke all on function public.dose_friend_add(text) from public, anon;
revoke all on function public.dose_friend_remove(uuid) from public, anon;
revoke all on function public.dose_friends_today() from public, anon;
grant execute on function public.dose_me() to authenticated;
grant execute on function public.dose_set_name(text) to authenticated;
grant execute on function public.dose_friend_add(text) to authenticated;
grant execute on function public.dose_friend_remove(uuid) to authenticated;
grant execute on function public.dose_friends_today() to authenticated;
