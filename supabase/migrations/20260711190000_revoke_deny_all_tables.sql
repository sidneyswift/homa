-- Migration #56: explicit table-level revokes for deny-all server tables.
-- These tables already rely on RLS with no Data API policies. The revoke is
-- defense-in-depth so a future broad grant or policy mistake has to cross one
-- more boundary before anon or authenticated roles can touch token, phone,
-- usage, or fleet research rows.

revoke all on table public.phone_leads from anon, authenticated;
revoke all on table public.phone_link_requests from anon, authenticated;
revoke all on table public.phone_claim_codes from anon, authenticated;
revoke all on table public.model_usage from anon, authenticated;
revoke all on table public.knowledge_bank from anon, authenticated;
