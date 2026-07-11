-- Migration #54: belt-and-braces REVOKE on the deny-all, server-only tables
-- (2026-07-11 code review, CR-32). Each of these already enables RLS with
-- zero policies, which denies every Data API role today; the explicit
-- revoke means a future accidental GRANT (or a policy mistake) cannot expose
-- them before a table that carries the revoke would. Mirrors the existing
-- family_invites / family_phones posture (RLS on + revoke).
--
-- Additive and safe to lead a deploy: revoke only removes latent privileges
-- no application code relies on (all access to these tables is via the
-- server-only Postgres connection in lib/, never the Data API). Revoking a
-- privilege a role never held is a harmless no-op.
revoke all on table public.phone_leads from anon, authenticated;
revoke all on table public.phone_link_requests from anon, authenticated;
revoke all on table public.phone_claim_codes from anon, authenticated;
revoke all on table public.model_usage from anon, authenticated;
revoke all on table public.knowledge_bank from anon, authenticated;
