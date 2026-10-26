-- Daily Dose, setup 14: Mind Meld forgives two swapped letters ("pengiun" for penguin) the same as one
-- wrong letter. Plain edit distance counts a swap as two mistakes, so common typos were missed. Safe to run twice.

-- True when b is a with exactly one pair of neighbouring letters swapped.
create or replace function public.dose_meld_swap1(a text, b text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare i int;
begin
  if a = b or length(a) <> length(b) or length(a) < 2 then return false; end if;
  for i in 1..length(a) - 1 loop
    if substr(a, 1, i - 1) || substr(a, i + 1, 1) || substr(a, i, 1) || substr(a, i + 2) = b then return true; end if;
  end loop;
  return false;
end $$;
revoke all on function public.dose_meld_swap1(text, text) from public, anon, authenticated;

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
      d := case when public.dose_meld_swap1(cn, n) then 1 else extensions.levenshtein(n, cn) end;
      if d <= tol and d < best_d then best := a->>0; best_d := d; end if;
    end loop;
  end loop;
  return best;
end $$;
revoke all on function public.dose_meld_match(jsonb, text) from public, anon, authenticated;
