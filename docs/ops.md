# Operator Notes

## Hosted project baseline

- keep the production project linked with `supabase link --project-ref <project-ref>`
- push migrations with `npm run supabase:deploy`
- keep Edge Function secrets in the hosted project, not in repo-local shell history

## V1 moderation loop

- reports create a durable `session_reports` row
- reporter automatically blocks the reported profile
- future matching should suppress blocked pairs

## Things to watch

- repeated anonymous sign-ups from abusive clients
- match request spam
- empty pool segments that never convert into live sessions

## Early manual checks

- review block growth
- review report reasons
- review whether deferred invites ever convert
