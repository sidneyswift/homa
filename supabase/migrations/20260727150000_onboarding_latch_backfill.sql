-- Release the families latched onboarding-active
-- (plans/2026-07-27-packet-page-revision-failure.md, latent bug).
--
-- completeOnboarding() shipped with no callers, so nothing ever wrote
-- state "done". readOnboardingRecord treats any record that does not say
-- "done" as active, and the record outranks profile_completed_at, so a
-- family who entered the chat flow could never leave it: create_printable
-- and generate_image structurally absent from her web chat every turn
-- (the generation gate), and the $19 door wall bypassed for good.
--
-- Measured on prod 2026-07-27: 30 live families latched, 28 of them with
-- a finished profile, all stamped 2026-07-23 or 2026-07-24 while
-- HOMA_CHAT_ONBOARDING was on. The flag has been off since, so the
-- predicate short-circuits false today and none of them is currently
-- harmed. This backfill exists so that turning the flag back on does not
-- silently strand them, which it would.
--
-- Two shapes are latched, and the second is why the first count was
-- wrong. Twenty-three records carry state "active". Seven carry NO state
-- key at all, written by start_checklist patching a checklist onto a
-- family that had no record; those read as active through the
-- "anything not done is active" normalization, invisibly to a query
-- grouping on ->>'state'. Both are handled here, and every touched
-- record ends up with an EXPLICIT state so the absent-key shape stops
-- being a thing anyone has to know about.
--
-- Ordering: data-only, no schema change, and a no-op for behavior while
-- the flag is off. Safe to apply before or after the deploy.

-- 1. Finished setup, so she is a normal /app family: mark her done.
--    This is the population the wall should apply to and whose in-turn
--    generation tools should exist.
update public.families
   set context = jsonb_set(
         coalesce(context, '{}'::jsonb),
         '{onboarding,state}',
         '"done"'::jsonb,
         true
       ),
       updated_at = now()
 where status <> 'deleted'
   and profile_completed_at is not null
   and jsonb_typeof(context->'onboarding') = 'object'
   and coalesce(context->'onboarding'->>'state', 'active') <> 'done';

-- 2. Never finished setup, so she is genuinely still onboarding and must
--    keep the flow if the flag returns. Only normalize the shape: write
--    the state she already reads as, so no future query has to know that
--    an absent key means active.
--
--    Verified against prod 2026-07-27: this statement matches nothing
--    today, because all seven stateless records belong to families with
--    a finished profile and statement 1 already claimed them. It stays
--    because the shape is reachable (any start_checklist call on a
--    recordless family creates it) and a stateless record landing
--    between this file's authoring and its apply should not survive.
--
--    updated_at and the record's own updatedAt are deliberately NOT
--    touched here. ONBOARDING_BACKSTOP_DAYS ages a stranded family out
--    of onboarding from that timestamp, and bumping it would push these
--    families' release further away, which is the opposite of the point.
--
--    Two families are left latched on purpose: profile unfinished, so
--    they should keep the flow if the flag returns, and the backstop
--    releases them on its own around 2026-08-06.
update public.families
   set context = jsonb_set(
         coalesce(context, '{}'::jsonb),
         '{onboarding,state}',
         '"active"'::jsonb,
         true
       )
 where status <> 'deleted'
   and profile_completed_at is null
   and jsonb_typeof(context->'onboarding') = 'object'
   and context->'onboarding'->>'state' is null;
