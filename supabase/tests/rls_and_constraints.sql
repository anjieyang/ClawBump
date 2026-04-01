do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles'
  ) then
    raise exception 'expected table public.profiles';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    raise exception 'expected profile RLS policy';
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'blocks'
      and constraint_type = 'UNIQUE'
  ) then
    raise exception 'expected unique constraint on blocks';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shadow_sessions'::regclass
      and attname = 'eligible_for_rematch_at'
      and not attisdropped
  ) then
    raise exception 'expected eligible_for_rematch_at on shadow_sessions';
  end if;
end
$$;

