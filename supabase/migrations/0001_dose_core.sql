-- Daily Dose, setup 1: profiles, plays, and the server-side Vault.
-- Lives in Job's spare "JobDone" Supabase project next to KeepUp (keepup_) and Petal (petal schema).
-- Every Daily Dose table starts with dose_. Safe to run twice.

create table if not exists public.dose_profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) between 1 and 30),
  country text check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);
alter table public.dose_profiles enable row level security;
drop policy if exists "own profile" on public.dose_profiles;
create policy "own profile" on public.dose_profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Today's vault code. No policies: nobody can read it from the app, only the functions below.
create table if not exists public.dose_vault_days (
  day date primary key,
  code smallint[] not null check (array_length(code, 1) = 4)
);
alter table public.dose_vault_days enable row level security;

-- One official result per player, per game, per day. Written only by the server functions.
-- guesses = [{"g":[0,1,2,3],"x":1,"n":2}, ...]
create table if not exists public.dose_plays (
  user_id uuid not null references auth.users on delete cascade,
  game text not null check (game in ('vault', 'last', 'meld')),
  day date not null,
  guesses jsonb not null default '[]',
  won boolean,
  result jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, game, day)
);
alter table public.dose_plays enable row level security;
drop policy if exists "read own plays" on public.dose_plays;
create policy "read own plays" on public.dose_plays for select to authenticated using (user_id = (select auth.uid()));

-- Make (or fetch) the code for a day. Random, decided by the server the first time anyone plays.
create or replace function public.dose_vault_code(p_day date) returns smallint[]
language plpgsql security definer set search_path = '' as $$
declare c smallint[];
begin
  insert into public.dose_vault_days (day, code)
  values (p_day, array(select floor(random() * 6)::smallint from generate_series(1, 4)))
  on conflict (day) do nothing;
  select code into c from public.dose_vault_days where day = p_day;
  return c;
end $$;
revoke all on function public.dose_vault_code(date) from public, anon, authenticated;

-- One guess at today's vault. Checks it on the server and returns only the hints.
-- The code itself is returned once the vault is opened or all 8 tries are used.
create or replace function public.dose_vault_guess(p_guess smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  code smallint[];
  play public.dose_plays;
  x int := 0; n int := 0; i int; s int;
  left_g int[] := '{}'; left_c int[] := '{}';
  v_won boolean; v_over boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if array_length(p_guess, 1) is distinct from 4 or exists (select 1 from unnest(p_guess) v where v is null or v < 0 or v > 5) then
    raise exception 'bad guess' using errcode = '22023';
  end if;

  insert into public.dose_plays (user_id, game, day) values (uid, 'vault', today) on conflict do nothing;
  select * into play from public.dose_plays where user_id = uid and game = 'vault' and day = today for update;
  if play.finished_at is not null or jsonb_array_length(play.guesses) >= 8 then
    raise exception 'already finished' using errcode = 'P0001';
  end if;

  code := public.dose_vault_code(today);
  for i in 1..4 loop
    if p_guess[i] = code[i] then x := x + 1;
    else left_g := left_g || p_guess[i]::int; left_c := left_c || code[i]::int; end if;
  end loop;
  foreach s in array left_g loop
    i := array_position(left_c, s);
    if i is not null then n := n + 1; left_c := left_c[:i - 1] || left_c[i + 1:]; end if;
  end loop;

  v_won := x = 4;
  v_over := v_won or jsonb_array_length(play.guesses) + 1 >= 8;
  update public.dose_plays set
    guesses = guesses || jsonb_build_array(jsonb_build_object('g', to_jsonb(p_guess), 'x', x, 'n', n)),
    won = case when v_over then v_won end,
    result = case when v_over then jsonb_build_object('code', to_jsonb(code)) end,
    finished_at = case when v_over then now() end
  where user_id = uid and game = 'vault' and day = today;

  return jsonb_build_object('x', x, 'n', n, 'over', v_over, 'won', v_won, 'code', case when v_over then to_jsonb(code) end);
end $$;
revoke all on function public.dose_vault_guess(smallint[]) from public, anon;
grant execute on function public.dose_vault_guess(smallint[]) to authenticated;
