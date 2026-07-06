-- Migration #10: separate emailed-link tokens from device cookies.
-- Found live in testing: cron sends (reminder / band-ready / retest) rotated
-- resume_token_hash, which silently killed the httpOnly cookie on the device
-- the parent originally used. Emailed links now mint their own token; the
-- device cookie keeps working until the flow itself refreshes it.

alter table public.lead_families add column link_token_hash text;
