-- Keep every founder verdict on a studio run, not just the last one
-- (founder ruling 2026-07-28, D5 of the training-corpus package, gh#328).
--
-- The 2026-07-18 feedback migration said in its own header that "history is
-- not kept on purpose, the packet is the export". That was right for the
-- iteration loop it was built for, and wrong for what the verdicts turned
-- out to be worth: a critique attached to the version it was about, followed
-- by an approved version, is exactly the (rejected, chosen) pair a model
-- learns taste from. Overwriting the old verdict deleted one of those every
-- time the founder changed their mind, which is the most common case on a
-- run that took several tries to get right.
--
-- Shape: append-only child rows. The parent's feedback, feedback_tags and
-- feedback_at columns stay exactly as they are and keep meaning "the latest
-- verdict", so every existing reader (the run list's "feedback left" pill,
-- the improvement packet, the detail page) works unchanged. This migration
-- adds a table and nothing else.
--
-- Additive only, so it may lead the deploy that reads it (AGENTS.md deploy
-- law). Readers treat a missing table as an empty history.
--
-- Founder-only surface, same posture as the parent: RLS on with no policies,
-- no Data API access, all writes through lib/map/db.ts behind the admin gate.

create table if not exists public.materials_studio_run_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.materials_studio_runs (id) on delete cascade,
  -- The verdict, verbatim. Same bound as the parent column it mirrors.
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  feedback_tags text[] not null default '{}',
  -- Which material version the verdict was about, when the run produced
  -- one. This is what makes a verdict a training pair rather than a note:
  -- without it, a critique cannot be attached to the draft it rejected.
  -- Nullable because a run can fail before create_printable ever fires.
  material_id uuid references public.materials (id) on delete set null,
  -- The founder who left it (email from the admin gate), so a future
  -- multi-reviewer bench can tell verdicts apart.
  left_by text check (left_by is null or char_length(left_by) <= 200),
  created_at timestamptz not null default now()
);

-- The read is always "this run's verdicts, newest first".
create index if not exists materials_studio_run_feedback_run_idx
  on public.materials_studio_run_feedback (run_id, created_at desc);

-- The training read is "every verdict about this material".
create index if not exists materials_studio_run_feedback_material_idx
  on public.materials_studio_run_feedback (material_id)
  where material_id is not null;

alter table public.materials_studio_run_feedback enable row level security;
revoke all on table public.materials_studio_run_feedback from anon, authenticated;
