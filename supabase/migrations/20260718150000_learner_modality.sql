-- Migration: Learner Modality Profile System
-- Adds modality classification to memories and a granular signal history
-- table for building per-child, per-subject learning tendency profiles.
-- Design doc: .cosmo/investigations/2026-07-18-learner-profile-modality-system.md

-- 1. Add modality column to family_memories (nullable, backwards compatible).
--    Only meaningful for kind='what_works'; null = unclassified.
ALTER TABLE public.family_memories
  ADD COLUMN IF NOT EXISTS modality text
  CHECK (modality IS NULL OR modality IN ('visual', 'auditory', 'kinesthetic', 'reading_writing'));

COMMENT ON COLUMN public.family_memories.modality IS
  'Learning modality this what_works memory is about. Null for facts and unclassified entries.';

CREATE INDEX IF NOT EXISTS idx_family_memories_modality
  ON public.family_memories (family_id, child_id, modality)
  WHERE modality IS NOT NULL AND superseded_at IS NULL;

-- 2. learner_modality_signals: append-only signal history.
--    The synthesized profile lives in children.profile JSONB (no migration
--    needed — JSONB is schema-flexible). This table is the raw evidence
--    the profile is derived from.
CREATE TABLE IF NOT EXISTS public.learner_modality_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  modality text NOT NULL
    CHECK (modality IN ('visual', 'auditory', 'kinesthetic', 'reading_writing')),
  subject_id text
    CHECK (subject_id IS NULL OR subject_id ~ '^[a-z][a-z0-9_-]*$'),
  signal_type text NOT NULL
    CHECK (signal_type IN (
      'parent_stated',
      'lesson_what_worked',
      'memory_classified',
      'material_finalized',
      'reteach_signal',
      'agent_observed'
    )),
  valence smallint NOT NULL DEFAULT 1
    CHECK (valence IN (-1, 1)),
  content text
    CHECK (content IS NULL OR length(content) <= 300),
  source_session_id text,
  source_memory_id uuid REFERENCES public.family_memories(id) ON DELETE SET NULL,
  source_material_id uuid,
  source_lesson_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_modality_signals_child
  ON public.learner_modality_signals (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modality_signals_family
  ON public.learner_modality_signals (family_id);
CREATE INDEX IF NOT EXISTS idx_modality_signals_child_subject
  ON public.learner_modality_signals (child_id, subject_id, modality);

ALTER TABLE public.learner_modality_signals ENABLE ROW LEVEL SECURITY;

-- RLS mirrors family_memories: family_id must match the caller's family.
CREATE POLICY "members read their modality signals"
  ON public.learner_modality_signals
  FOR SELECT
  TO authenticated
  USING (public.is_family_member(family_id));

CREATE POLICY "members insert modality signals"
  ON public.learner_modality_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_family_member(family_id)
    AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = child_id AND c.family_id = learner_modality_signals.family_id
    )
  );

-- 3. Events (MJ-08 law: no feature merges without its events).
CREATE POLICY "members emit learner events for their family"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    name LIKE 'learner.%'
    AND family_id IS NOT NULL
    AND public.is_family_member(family_id)
  );
