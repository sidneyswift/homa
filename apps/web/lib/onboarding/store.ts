import { mapDb } from "../map/db";
import {
  EMPTY_ONBOARDING_RECORD,
  familyOnboardingActive,
  readOnboardingRecord,
  type OnboardingFamilyRow,
  type OnboardingRecord,
  type OnboardingState,
} from "./state";

/**
 * Chat-first onboarding, the durable stage store
 * (plans/2026-07-21-chat-first-onboarding.md §2.2).
 *
 * Server-only, deliberately separated from ./state.ts: the predicate is
 * imported by the eve channel and by client components, and "postgres"
 * has no browser build, so keeping the connection in its own module is
 * what stops a client import from taking the build down.
 */

/**
 * loadOnboardingState(familyId): the record plus the derived active
 * flag, read on the server-only connection. Returns null when the
 * family id does not resolve, which callers treat as "not onboarding"
 * rather than as an error: a missing family is never a reason to take
 * a working surface down.
 */
export async function loadOnboardingState(
  familyId: string,
): Promise<{ active: boolean; record: OnboardingRecord | null } | null> {
  const sql = mapDb();
  const rows = await sql<
    { profile_completed_at: string | null; context: unknown }[]
  >`
    select profile_completed_at::text as profile_completed_at, context
    from public.families
    where id = ${familyId}
  `;
  const row = rows[0];
  if (!row) return null;
  const shaped: OnboardingFamilyRow = {
    profileCompletedAt: row.profile_completed_at,
    context: row.context,
  };
  return {
    active: familyOnboardingActive(shaped),
    record: readOnboardingRecord(row.context),
  };
}

/**
 * The patch shape accepted by the writers below. Scalars replace;
 * beatsDone appends distinctly; checklist merges per child.
 */
export interface OnboardingPatch {
  state?: OnboardingState;
  addBeats?: string[];
  checklist?: Record<string, string>;
  paywallShownAt?: string;
}

/**
 * writeOnboardingRecord(familyId, patch): the one write path.
 *
 * The merge happens inside a single UPDATE, computed from the row's own
 * current value, so a concurrent write to a sibling context key (styles,
 * curriculums, values, all written by other surfaces) survives. A
 * read-modify-write in application code would drop whichever write lost
 * the race, and the losing key would be someone's curriculum answers.
 *
 * beatsDone appends distinctly rather than replacing, because two beats
 * can fire from two turns closely enough to interleave, and a beat that
 * fired is a fact that must not be un-recorded.
 */
export async function writeOnboardingRecord(
  familyId: string,
  patch: OnboardingPatch,
): Promise<OnboardingRecord> {
  const sql = mapDb();
  const scalars: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (patch.state) scalars.state = patch.state;
  if (patch.paywallShownAt) scalars.paywallShownAt = patch.paywallShownAt;
  const addBeats = patch.addBeats?.filter((beat) => beat.length > 0) ?? [];
  const checklist = patch.checklist ?? {};

  const rows = await sql<{ onboarding: unknown }[]>`
    with current as (
      select coalesce(context->'onboarding', '{}'::jsonb) as record
      from public.families
      where id = ${familyId}
    ),
    merged as (
      select
        (
          (current.record || ${sql.json(scalars)}::jsonb)
          || jsonb_build_object(
               'beatsDone',
               (
                 select coalesce(jsonb_agg(distinct beat), '[]'::jsonb)
                 from jsonb_array_elements_text(
                   coalesce(current.record->'beatsDone', '[]'::jsonb)
                   || ${sql.json(addBeats)}::jsonb
                 ) as beat
               ),
               'checklist',
               coalesce(current.record->'checklist', '{}'::jsonb)
                 || ${sql.json(checklist)}::jsonb
             )
        ) as record
      from current
    )
    update public.families
    set context = jsonb_set(
          coalesce(context, '{}'::jsonb),
          '{onboarding}',
          (select record from merged),
          true
        ),
        updated_at = now()
    where id = ${familyId}
    returning context->'onboarding' as onboarding
  `;
  const written = rows[0]?.onboarding;
  return (
    readOnboardingRecord({ onboarding: written }) ?? {
      ...EMPTY_ONBOARDING_RECORD,
      ...(patch.state ? { state: patch.state } : {}),
    }
  );
}

/**
 * beginOnboarding(familyId): stamps the record the first time a family
 * enters the chat flow, so from then on the record is the truth and
 * profile_completed_at stops mattering for this family. Idempotent: a
 * family already marked done is never reopened by a stray call.
 */
export async function beginOnboarding(familyId: string): Promise<OnboardingRecord | null> {
  const existing = await loadOnboardingState(familyId);
  if (existing?.record?.state === "done") return existing.record;
  return writeOnboardingRecord(familyId, { state: "active" });
}

/**
 * completeOnboarding(familyId): the end of the free-period arc. After
 * this the family is a normal /app family: the door wall applies again,
 * onboarding-mode stops loading, and the re-entry directive stops firing.
 */
export async function completeOnboarding(familyId: string): Promise<OnboardingRecord> {
  return writeOnboardingRecord(familyId, { state: "done" });
}
