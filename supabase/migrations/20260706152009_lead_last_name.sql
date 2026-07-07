-- Migration #17: the parent's last name (founder call 2026-07-06: entry
-- screen collects first + last name, before kids, before email). Same
-- deny-all posture as migration #7: server routes only.

alter table public.lead_families add column last_name text;
