-- The wall (paywall groundwork, built DARK behind HOMA_WALL_ENABLED;
-- plan: docs/homa-planning/plans/2026-07-11-the-wall.md). Additive only,
-- safe to lead the deploy.
--
-- trial_started_at: stamped once by /api/billing/confirm after a verified
--   Stripe Payment Link checkout (card-upfront trial, ruling T1). Non-null
--   means every door is open for this family.
-- billing_exempt: the founder's comp switch, set by hand in SQL for
--   families that should never see the wall (testers, family, press).
-- stripe_customer_id: the money-layer join for later phases (portal,
--   webhooks); nullable and unused by reads today.
--
-- No policy changes: members could already select their own family row,
-- and none of these values is a secret from the family it belongs to.
-- Writes go through the server-only connection (lib/map/db.ts), the same
-- path as every other families write.
alter table public.families
  add column if not exists trial_started_at timestamptz,
  add column if not exists billing_exempt boolean not null default false,
  add column if not exists stripe_customer_id text;
