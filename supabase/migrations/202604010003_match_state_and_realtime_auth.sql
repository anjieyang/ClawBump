do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_requests_status_check'
      and conrelid = 'public.match_requests'::regclass
  ) then
    alter table public.match_requests
      add constraint match_requests_status_check
      check (status in ('open', 'matched', 'expired', 'cancelled'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_invites_status_check'
      and conrelid = 'public.match_invites'::regclass
  ) then
    alter table public.match_invites
      add constraint match_invites_status_check
      check (status in ('pending', 'accepted', 'declined', 'expired'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shadow_sessions_status_check'
      and conrelid = 'public.shadow_sessions'::regclass
  ) then
    alter table public.shadow_sessions
      add constraint shadow_sessions_status_check
      check (status in ('live', 'ended', 'contact_shared'));
  end if;
end
$$;

create unique index if not exists idx_match_requests_requester_open
  on public.match_requests (requester_id)
  where status = 'open';

create policy "clawbump_realtime_select_topics"
  on realtime.messages
  for select
  to authenticated
  using (
    (
      realtime.topic() like 'pool:%'
      and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.audience_segment = split_part(realtime.topic(), ':', 2)
      )
    )
    or (
      realtime.topic() like 'shadow-session:%'
      and exists (
        select 1
        from public.shadow_session_members
        where shadow_session_members.profile_id = auth.uid()
          and shadow_session_members.session_id::text = split_part(realtime.topic(), ':', 2)
      )
    )
  );

create policy "clawbump_realtime_insert_topics"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (
      realtime.topic() like 'pool:%'
      and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.audience_segment = split_part(realtime.topic(), ':', 2)
      )
    )
    or (
      realtime.topic() like 'shadow-session:%'
      and exists (
        select 1
        from public.shadow_session_members
        where shadow_session_members.profile_id = auth.uid()
          and shadow_session_members.session_id::text = split_part(realtime.topic(), ':', 2)
      )
    )
  );
