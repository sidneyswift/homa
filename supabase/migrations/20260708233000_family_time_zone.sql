-- Migration #30: the family's time zone, one nullable text column
-- (IANA name, e.g. "America/New_York"). The dashboard greeting and the
-- week planner's dates rendered in America/Chicago as the honest middle
-- of a US-only audience; this makes them exact. Null means "not captured
-- yet" and the UI quietly self-fills it from the signed-in parent's own
-- device on the next /home visit (a settings card can override it).
--
-- Idempotent on purpose: the column may land via MCP before the GitHub
-- integration replays this file.
--
-- Isolation posture unchanged: families has deny-by-default RLS
-- (members-only SELECT) and every write path goes through the
-- server-only connection with familyId from the caller's own session.

alter table public.families
  add column if not exists time_zone text;
