import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  EMPTY_ONBOARDING_RECORD,
  familyOnboardingActive,
  onboardingCompletionCause,
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
  // A record of either state already makes profile_completed_at
  // irrelevant, so there is nothing to write; rewriting "active" on
  // every visit would be a wasted row update per page load.
  if (existing?.record) return existing.record;
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

/**
 * resolveOnboardingCompletion(familyId): ask whether this family has
 * finished, and write it down if she has. Returns true when the family
 * is done (whether this call ended it or an earlier one did).
 *
 * This exists because completeOnboarding shipped with no caller. The
 * record outranks profile_completed_at, so a family who entered the chat
 * flow could never leave it: her in-turn generation tools stayed
 * suppressed and her door wall stayed down, permanently. Every surface
 * that could release a family calls this, and it is cheap and idempotent
 * so calling it on a page load is fine.
 *
 * Reads its own facts rather than trusting a caller's: the wall's state
 * depends on the answer, so the inputs come from the database on the
 * server-only connection, never from a page's props.
 */
export async function resolveOnboardingCompletion(familyId: string): Promise<boolean> {
  const state = await loadOnboardingState(familyId);
  if (!state?.record) return false;
  if (state.record.state === "done") return true;

  const sql = mapDb();
  const rows = await sql<
    { profile_completed_at: string | null; children: number; scored: number }[]
  >`
    select f.profile_completed_at::text as profile_completed_at,
           (select count(*) from public.children c where c.family_id = f.id)
             ::int as children,
           -- child_reports is keyed by child_id and has no family_id
           -- column, so this reaches the family through children. The
           -- original went straight at r.family_id, which threw 42703
           -- (undefined_column) on every call and turned /onboarding
           -- into the error page for any family whose onboarding record
           -- existed and was not already "done". The two guards above
           -- are the only reason it did not fire for everyone. Live from
           -- bbed4a4b (#239) until 2026-07-28, found when a family who
           -- had just paid refreshed and got "Something didn't load
           -- right".
           (select count(distinct r.child_id)
              from public.child_reports r
              join public.children rc on rc.id = r.child_id
             where rc.family_id = f.id)::int as scored
      from public.families f
     where f.id = ${familyId}
  `;
  const row = rows[0];
  if (!row) return false;

  const cause = onboardingCompletionCause({
    profileCompletedAt: row.profile_completed_at,
    childCount: row.children,
    scoredReportCount: row.scored,
    recordUpdatedAt: state.record.updatedAt,
    now: new Date(),
  });
  if (!cause) return false;
  await completeOnboarding(familyId);
  // The transition narrates itself (2026-08-30 spec, Outcome 5): this is
  // the free window's one decisive flip, and until this event existed the
  // cause was discarded inside the boolean above, so "why is this family
  // walled" took archaeology. Emitted only here, on the real
  // active -> done transition (the state === "done" early return above
  // keeps idempotent re-calls silent), after the write succeeds so the
  // trail never claims a flip the record does not show. Best-effort by
  // the analytics law: a failed emit never un-completes a family.
  // anchor_updated_at is the record write the backstop clock counted
  // from; see the registry comment on onboarding.completed.
  await emitMapEvent("onboarding.completed", {
    family_id: familyId,
    cause,
    anchor_updated_at: state.record.updatedAt,
    profile_completed: row.profile_completed_at !== null,
    child_count: row.children,
    scored_report_count: row.scored,
  });
  return true;
}

export interface OnboardingChatFamily {
  profileCompletedAt: string | null;
  context: unknown;
  timeZone: string | null;
  parentName: string | null;
  children: { id: string; name: string; avatarUrl: string | null }[];
}

/**
 * loadOnboardingChatFamily(familyId): the columns the chat phase needs
 * that the flow's own FamilyRow does not carry (the context blob, the
 * time zone, and the roster with avatars).
 *
 * Its own reader rather than a widened FamilyRow: that type is shared by
 * every map route, and growing it for one surface would make every one
 * of them pay for two columns they never read.
 */
export async function loadOnboardingChatFamily(
  familyId: string,
): Promise<OnboardingChatFamily | null> {
  const sql = mapDb();
  const [families, children] = await Promise.all([
    sql<
      {
        profile_completed_at: string | null;
        context: unknown;
        time_zone: string | null;
        first_name: string | null;
        parent_display_name: string | null;
      }[]
    >`
      select profile_completed_at::text as profile_completed_at, context, time_zone,
             first_name, parent_display_name
      from public.families
      where id = ${familyId}
    `,
    sql<{ id: string; name: string; avatar_url: string | null }[]>`
      select id, name, avatar_url
      from public.children
      where family_id = ${familyId}
      order by created_at asc
    `,
  ]);
  const family = families[0];
  if (!family) return null;
  return {
    profileCompletedAt: family.profile_completed_at,
    context: family.context,
    timeZone: family.time_zone,
    parentName: family.first_name ?? family.parent_display_name ?? null,
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      avatarUrl: child.avatar_url,
    })),
  };
}

export interface FamilyBasicsInput {
  /** What she wants Homa to call her. */
  callMeName?: string;
  /** The family's own name for itself, editable later. */
  familyName?: string;
  /** Two-letter US state; drives which homeschool rules Homa follows. */
  usState?: string;
  /** IANA zone, captured silently from the browser and confirmed lightly. */
  timeZone?: string;
  /** Her own photo, already uploaded to the avatars bucket client-side. */
  avatarUrl?: string;
}

/**
 * saveFamilyBasics(familyId, input, memberUserId): the micro-gather's one
 * write.
 *
 * Deliberately NOT lib/map/store.ts saveFamilySetup, which is the
 * settings form's writer: that one sets parent_avatar_url and the address
 * columns unconditionally, so calling it with the two fields a
 * conversation actually collects would blank a photo she had already
 * uploaded. Every column here coalesces, so a field she did not mention
 * keeps whatever it had.
 *
 * profile_completed_at is stamped once and never moved. It is what makes
 * /app reachable, and while the onboarding record says active it does NOT
 * end onboarding, because the record outranks the stamp.
 *
 * memberUserId mirrors her name and photo onto her own family_members row
 * too (same two-writes pattern saveFamilySetup uses), only when the
 * session is authenticated rather than an anonymous resume cookie. The
 * iPhone walk greets her from that row, so without the name mirror its
 * "While I draw, {parent}" and doors lines never said her name
 * (2026-11-04).
 */
export async function saveFamilyBasics(
  familyId: string,
  input: FamilyBasicsInput,
  memberUserId?: string | null,
): Promise<{ savedFields: string[] }> {
  const sql = mapDb();
  const callMeName = input.callMeName?.trim() || null;
  const familyName = input.familyName?.trim() || null;
  const usState = input.usState?.trim().toUpperCase() || null;
  const timeZone = input.timeZone?.trim() || null;
  const avatarUrl = input.avatarUrl?.trim() || null;
  await sql`
    update public.families set
      name = coalesce(${familyName}, name),
      first_name = coalesce(${callMeName}, first_name),
      parent_display_name = coalesce(${callMeName}, parent_display_name),
      us_state = coalesce(${usState}, us_state),
      time_zone = coalesce(${timeZone}, time_zone),
      parent_avatar_url = coalesce(${avatarUrl}, parent_avatar_url),
      profile_completed_at = coalesce(profile_completed_at, now()),
      updated_at = now()
    where id = ${familyId}
  `;
  if ((callMeName || avatarUrl) && memberUserId) {
    await sql`
      update public.family_members
      set display_name = coalesce(${callMeName}, display_name),
          avatar_url = coalesce(${avatarUrl}, avatar_url)
      where family_id = ${familyId} and user_id = ${memberUserId}
    `;
  }
  const savedFields: string[] = [];
  if (callMeName) savedFields.push("callMeName");
  if (familyName) savedFields.push("familyName");
  if (usState) savedFields.push("usState");
  if (timeZone) savedFields.push("timeZone");
  if (avatarUrl) savedFields.push("avatarUrl");
  return { savedFields };
}
