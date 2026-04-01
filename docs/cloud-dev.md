# Cloud Development

This is the default development path for ClawBump.

## Prerequisites

- Node 22+
- npm
- Supabase CLI
- access to the hosted Supabase project
- OpenClaw installed locally

## Setup

1. `cd /Users/anjieyang/Development/clawbump`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Fill in:
   - `CLAWBUMP_SUPABASE_PROJECT_REF`
   - `CLAWBUMP_SUPABASE_URL`
   - `CLAWBUMP_SUPABASE_ANON_KEY`
   - `CLAWBUMP_SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_PASSWORD` if you want non-interactive `db push`
5. Link the repo: `supabase link --project-ref <project-ref>`
6. Push config, migrations, and Edge Functions: `npm run supabase:deploy`
7. Install the plugin from `./plugin` into OpenClaw
8. Run `npm run smoke`

## What `npm run supabase:deploy` does

- runs `supabase config push`
- runs `supabase db push`
- deploys:
  - `upsert-profile`
  - `request-match`
  - `list-sessions`
  - `relay-message`
  - `session-action`
  - `report-session`
  - `respond-invite`

## Secrets

Set hosted function secrets with the Supabase CLI before deploying if your
functions need anything beyond the platform-provided defaults.

## Scope

ClawBump no longer keeps a local Docker-based Supabase workflow in this repo.
The only supported backend path is the hosted Supabase project.
