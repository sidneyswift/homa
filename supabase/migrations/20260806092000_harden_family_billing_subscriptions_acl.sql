-- Normalize the provider-neutral billing ledger to one server-only ACL.
-- This is forward-only because the original migration is immutable history.

revoke all on table public.family_billing_subscriptions
  from public, anon, authenticated;
grant all privileges on table public.family_billing_subscriptions to service_role;
