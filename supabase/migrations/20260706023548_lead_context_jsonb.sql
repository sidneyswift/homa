-- Migration #8: flexible context capture for the progress-report flow
-- (founder + Alessa read-through, 2026-07-05). The extras step collects
-- evolving optional context (interests, multi help-with, what's working,
-- homeschool style + strictness, curriculums, family values, notes), so
-- both levels get a jsonb bag instead of a rigid column per question.
-- Same deny-all posture as migration #7: server routes only.

alter table public.lead_families add column context jsonb not null default '{}'::jsonb;
alter table public.lead_children add column context jsonb not null default '{}'::jsonb;
