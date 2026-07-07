Supabase migrations for project homa-prod (kzplntcdtsvdowntvlza, org: Homa).

Every migration in this directory is applied to homa-prod with matching
version stamps (20 as of 2026-07-07; the filename timestamp is the version).
The Supabase GitHub integration watches this directory and treats existing
versions as already applied; new files land as new migrations on push.

Posture: RLS deny-by-default everywhere. Public traffic is write-only into
`waitlist` and `waitlist.*` rows of `events`; the `lead_*` tables are
deny-all and reachable only through server routes. Verify anytime with
`pnpm check:isolation`.
