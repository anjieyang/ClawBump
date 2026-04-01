# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is ClawBump

An OpenClaw-native anonymous social plugin for idea-driven collisions. Users talk only to their own OpenClaw assistant; Supabase is the V1 control plane. Chat transcripts are transient (broadcast via realtime, never stored). Durable state is limited to profiles, match requests, consent, reports, and blocks.

## Commands

```bash
# Plugin (Node/vitest)
npm test                          # run all plugin tests
npm run typecheck                 # tsc --noEmit on plugin
npx vitest run plugin/src/runtime/control-parser.test.ts  # single test file

# Supabase Edge Functions (Deno)
cd supabase/functions && deno test tests/request-match.test.ts  # single function test

# Deploy
npm run supabase:deploy           # push config + schema + all edge functions
npm run supabase:functions:deploy # edge functions only

# E2E smoke test against hosted backend (needs .env)
npm run smoke
```

Package manager is npm with workspaces (`plugin/` is the only workspace). A `pnpm-workspace.yaml` also exists but root scripts use npm.

## Architecture

```
OpenClaw host
  └─ plugin/index.ts  ← register(api) entry point
       ├─ 3 tools: clawbump_join_pool, clawbump_request_collision, clawbump_session_action
       ├─ 1 command: /bump (find|inbox|use|continue|contact|leave|report|send)
       └─ 1 service: "clawbump" (exposes session manager to host)

plugin/src/runtime/
  session-manager.ts  ← primary state machine (active session, cached sessions, subscriptions)
  service.ts          ← wraps all Edge Function calls + realtime channel setup
  supabase-auth.ts    ← anonymous sign-in, session persistence, authed client
  control-parser.ts   ← classifies input as peer / assistant / ambiguous
  realtime.ts         ← pool presence channels + shadow-session broadcast channels

supabase/functions/
  request-match/      ← CORE: scoring algorithm, atomic claim, shadow session creation
  relay-message/      ← broadcast peer message via realtime (not stored)
  session-action/     ← consent state machine (continue / share_contact / leave)
  upsert-profile/     ← onboarding: profile + facets
  list-sessions/      ← fetch user's sessions
  report-session/     ← abuse report + auto-block
  _shared/            ← auth helpers, env, HTTP utils, rate limiter
```

### Data flow: sending a message

User text → `parseControlInput()` (peer / assistant / ambiguous) → `service.relayMessage()` → Edge Function verifies membership + live status → HTTP POST to Supabase Realtime broadcast on `shadow-session:<id>` → peer's subscription fires `onRelay()`.

### Data flow: matching

`request-match` Edge Function: insert open request → find up to 20 candidates in same segment → score (topic 0.45 + constraint 0.2 + shared facets 0.3 + segment 0.1 + base 0.2) → atomic claim via `update where status='open'` → create shadow_session + members → return session or deferred.

### Consent model

`session_consents` table tracks per-member consent for `continue_anonymous` and `share_contact`. State resolves as: any declined → locked, both accepted → unlocked, otherwise → pending. Contact exchange is irreversible.

## Database

Schema lives in `supabase/migrations/` (3 migration files). Core tables: `profiles`, `profile_facets`, `match_requests`, `shadow_sessions`, `shadow_session_members`, `session_consents`, `session_reports`, `blocks`. All tables have RLS policies. Anonymous auth is enabled.

## Key Design Decisions

- **No app server**: V1 backend is Supabase (DB + Edge Functions + Realtime) only.
- **Message transience**: relay-message broadcasts but does not INSERT. Privacy by default.
- **Anonymous auth**: `supabase.auth.signInAnonymously()`. No email/password.
- **Shadow labels**: peers are "Shadow A" / "Shadow B", never real identities.
- **Explicit addressing**: bare text defaults to peer. Assistant commands require `/` prefix or the configured `assistantAddress` (default: "龙虾"). Ambiguous input is rejected with a clarification prompt.
- **Atomic matching**: `claimOpenRequest` updates with `eq(status, 'open')` to prevent double-booking.
- **Rate limiting**: in-memory, 20 requests / 60s per user per Edge Function.

## Edge Function Conventions

All functions follow: `requireUserId(req)` → `assertRateLimit()` → parse payload → business logic with admin client → return `json({ ok, ... })`. Shared code in `supabase/functions/_shared/`. Functions import from `@supabase/supabase-js` via Supabase's built-in import map.

## Plugin Skill

`plugin/skills/clawbump/SKILL.md` instructs the assistant on message routing defaults, rewrite policy, and consent guardrails. Templates in `plugin/skills/clawbump/templates/`.

## Testing

- **Plugin tests**: vitest, files colocated as `*.test.ts` alongside source.
- **Edge Function tests**: Deno's built-in test runner (`Deno.test`), files in `supabase/functions/tests/`. These are pure unit tests (e.g. scoring logic, consent resolution) — no live Supabase needed.
- **Smoke test**: `scripts/smoke-runner.mjs` runs a full E2E flow against the hosted backend (two anonymous users, match, relay, consent, leave).
