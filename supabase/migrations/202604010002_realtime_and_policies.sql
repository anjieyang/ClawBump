alter table public.profiles enable row level security;
alter table public.profile_facets enable row level security;
alter table public.match_requests enable row level security;
alter table public.match_invites enable row level security;
alter table public.shadow_sessions enable row level security;
alter table public.shadow_session_members enable row level security;
alter table public.session_consents enable row level security;
alter table public.session_feedback enable row level security;
alter table public.session_reports enable row level security;
alter table public.blocks enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_self"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profile_facets_own"
  on public.profile_facets
  for all
  using (exists (
    select 1
    from public.profiles
    where profiles.id = profile_facets.profile_id
      and profiles.id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.profiles
    where profiles.id = profile_facets.profile_id
      and profiles.id = auth.uid()
  ));

create policy "match_requests_own"
  on public.match_requests
  for all
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

create policy "match_invites_visible_to_participants"
  on public.match_invites
  for select
  using (requester_id = auth.uid() or recipient_id = auth.uid());

create policy "match_invites_recipient_updates"
  on public.match_invites
  for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "shadow_sessions_visible_to_members"
  on public.shadow_sessions
  for select
  using (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.session_id = shadow_sessions.id
      and shadow_session_members.profile_id = auth.uid()
  ));

create policy "shadow_session_members_visible_to_session_members"
  on public.shadow_session_members
  for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1
      from public.shadow_session_members mine
      where mine.session_id = shadow_session_members.session_id
        and mine.profile_id = auth.uid()
    )
  );

create policy "session_consents_visible_to_session_members"
  on public.session_consents
  for select
  using (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_consents.member_id
      and shadow_session_members.profile_id = auth.uid()
  ));

create policy "session_consents_manage_own_member_rows"
  on public.session_consents
  for all
  using (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_consents.member_id
      and shadow_session_members.profile_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_consents.member_id
      and shadow_session_members.profile_id = auth.uid()
  ));

create policy "session_feedback_manage_own_member_rows"
  on public.session_feedback
  for all
  using (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_feedback.member_id
      and shadow_session_members.profile_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_feedback.member_id
      and shadow_session_members.profile_id = auth.uid()
  ));

create policy "session_reports_manage_reporter_rows"
  on public.session_reports
  for all
  using (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_reports.reporter_member_id
      and shadow_session_members.profile_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.shadow_session_members
    where shadow_session_members.id = session_reports.reporter_member_id
      and shadow_session_members.profile_id = auth.uid()
  ));

create policy "blocks_manage_own_rows"
  on public.blocks
  for all
  using (blocker_profile_id = auth.uid())
  with check (blocker_profile_id = auth.uid());

alter publication supabase_realtime add table public.match_invites;
alter publication supabase_realtime add table public.shadow_sessions;
alter publication supabase_realtime add table public.session_consents;

