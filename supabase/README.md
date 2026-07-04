Supabase migrations for project homa-prod (kzplntcdtsvdowntvlza, org: Homa).

Migrations #1–3 are applied to homa-prod and mirrored here with matching
version stamps. The Supabase GitHub integration can be connected now (it
watches this directory); it will see these versions as already applied.

Posture: RLS deny-by-default everywhere. Public traffic is write-only into
`waitlist` and `waitlist.*` rows of `events`. Verify anytime with
`pnpm check:isolation`.
