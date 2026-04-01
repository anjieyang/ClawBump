create or replace function public.is_shadow_session_member(
  target_session_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shadow_session_members
    where session_id = target_session_id
      and profile_id = target_profile_id
  );
$$;

create or replace function public.is_shadow_session_member_text(
  target_session_id_text text,
  target_profile_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shadow_session_members
    where session_id::text = target_session_id_text
      and profile_id = target_profile_id
  );
$$;

create or replace function public.is_shadow_session_member_row(
  target_member_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shadow_session_members
    where id = target_member_id
      and profile_id = target_profile_id
  );
$$;

revoke all on function public.is_shadow_session_member(uuid, uuid) from public;
revoke all on function public.is_shadow_session_member_text(text, uuid) from public;
revoke all on function public.is_shadow_session_member_row(uuid, uuid) from public;

grant execute on function public.is_shadow_session_member(uuid, uuid) to authenticated;
grant execute on function public.is_shadow_session_member_text(text, uuid) to authenticated;
grant execute on function public.is_shadow_session_member_row(uuid, uuid) to authenticated;

drop policy if exists "shadow_sessions_visible_to_members" on public.shadow_sessions;
create policy "shadow_sessions_visible_to_members"
  on public.shadow_sessions
  for select
  using (public.is_shadow_session_member(id, auth.uid()));

drop policy if exists "shadow_session_members_visible_to_session_members" on public.shadow_session_members;
create policy "shadow_session_members_visible_to_session_members"
  on public.shadow_session_members
  for select
  using (
    profile_id = auth.uid()
    or public.is_shadow_session_member(session_id, auth.uid())
  );

drop policy if exists "session_consents_visible_to_session_members" on public.session_consents;
create policy "session_consents_visible_to_session_members"
  on public.session_consents
  for select
  using (public.is_shadow_session_member_row(member_id, auth.uid()));

drop policy if exists "session_consents_manage_own_member_rows" on public.session_consents;
create policy "session_consents_manage_own_member_rows"
  on public.session_consents
  for all
  using (public.is_shadow_session_member_row(member_id, auth.uid()))
  with check (public.is_shadow_session_member_row(member_id, auth.uid()));

drop policy if exists "session_feedback_manage_own_member_rows" on public.session_feedback;
create policy "session_feedback_manage_own_member_rows"
  on public.session_feedback
  for all
  using (public.is_shadow_session_member_row(member_id, auth.uid()))
  with check (public.is_shadow_session_member_row(member_id, auth.uid()));

drop policy if exists "session_reports_manage_reporter_rows" on public.session_reports;
create policy "session_reports_manage_reporter_rows"
  on public.session_reports
  for all
  using (public.is_shadow_session_member_row(reporter_member_id, auth.uid()))
  with check (public.is_shadow_session_member_row(reporter_member_id, auth.uid()));

drop policy if exists "clawbump_realtime_select_topics" on realtime.messages;
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
      and public.is_shadow_session_member_text(split_part(realtime.topic(), ':', 2), auth.uid())
    )
  );

drop policy if exists "clawbump_realtime_insert_topics" on realtime.messages;
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
      and public.is_shadow_session_member_text(split_part(realtime.topic(), ':', 2), auth.uid())
    )
  );
