-- Migration #25: the lead world retires (one-world unification,
-- 2026-07-07). The new code is READY in prod, the gap-window sweep came
-- back empty (every lead kid mapped, every report token carried), and
-- nothing reads or writes these five tables anymore.

drop table if exists public.lead_answers;
drop table if exists public.lead_plans;
drop table if exists public.lead_reports;
drop table if exists public.lead_children;
drop table if exists public.lead_families;
