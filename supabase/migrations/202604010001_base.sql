create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_locale text not null default 'zh-CN',
  assistant_address text not null default '龙虾',
  audience_segment text not null default 'ai-tech-startup',
  profile_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_facets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  facet_key text not null,
  facet_value text not null,
  facet_source text not null default 'onboarding',
  weight numeric not null default 1.0,
  created_at timestamptz not null default now(),
  unique (profile_id, facet_key, facet_value)
);

create table if not exists public.match_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  topic text,
  constraint_text text,
  audience_segment text not null default 'ai-tech-startup',
  availability_mode text not null default 'hybrid',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.match_invites (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  source_request_id uuid references public.match_requests (id) on delete set null,
  compatibility_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);

create table if not exists public.shadow_sessions (
  id uuid primary key default gen_random_uuid(),
  source_request_id uuid references public.match_requests (id) on delete set null,
  intro_summary text not null default '',
  opener_prompt text not null default '',
  status text not null default 'live',
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  eligible_for_rematch_at timestamptz
);

create table if not exists public.shadow_session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.shadow_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  shadow_label text not null,
  role text not null default 'participant',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (session_id, profile_id),
  unique (session_id, shadow_label)
);

create table if not exists public.session_consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.shadow_sessions (id) on delete cascade,
  member_id uuid not null references public.shadow_session_members (id) on delete cascade,
  consent_kind text not null check (consent_kind in ('continue_anonymous', 'share_contact')),
  state text not null check (state in ('pending', 'accepted', 'declined', 'revoked')),
  contact_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, member_id, consent_kind)
);

create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.shadow_sessions (id) on delete cascade,
  member_id uuid not null references public.shadow_session_members (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  vibe_tags text[] not null default '{}',
  wanted_followup boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create table if not exists public.session_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.shadow_sessions (id) on delete cascade,
  reporter_member_id uuid not null references public.shadow_session_members (id) on delete cascade,
  reported_member_id uuid not null references public.shadow_session_members (id) on delete cascade,
  reason text not null,
  detail text,
  evidence_excerpt text,
  created_at timestamptz not null default now(),
  check (reporter_member_id <> reported_member_id)
);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_profile_id uuid not null references public.profiles (id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles (id) on delete cascade,
  source_session_id uuid references public.shadow_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (blocker_profile_id, blocked_profile_id),
  check (blocker_profile_id <> blocked_profile_id)
);

create index if not exists idx_profile_facets_profile_id on public.profile_facets (profile_id);
create index if not exists idx_match_requests_status_segment on public.match_requests (status, audience_segment, created_at desc);
create index if not exists idx_match_invites_recipient_status on public.match_invites (recipient_id, status, created_at desc);
create index if not exists idx_shadow_session_members_profile_id on public.shadow_session_members (profile_id);
create index if not exists idx_shadow_session_members_session_id on public.shadow_session_members (session_id);
create index if not exists idx_session_consents_session_kind on public.session_consents (session_id, consent_kind);
create index if not exists idx_blocks_pair on public.blocks (blocker_profile_id, blocked_profile_id);

