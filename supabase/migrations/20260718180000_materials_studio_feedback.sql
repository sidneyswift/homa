-- Founder feedback on material studio runs (/admin/studio iteration
-- loop, founder ask 2026-07-18 evening): each test run can carry one
-- founder verdict, tags plus prose, that the "Prompt for agent" packet
-- copies out so a coding agent can improve the materials-studio skill
-- against it. Latest feedback wins (feedback_at is the stamp); history
-- is not kept on purpose, the packet is the export.
--
-- Additive only, same deny-all posture as the parent table: no Data API
-- access, founder-gated server action writes via lib/map/db.ts.

alter table public.materials_studio_runs
  add column if not exists feedback text
    check (feedback is null or char_length(feedback) <= 2000),
  add column if not exists feedback_tags text[] not null default '{}',
  add column if not exists feedback_at timestamptz;
