import type { Sql } from "postgres";

/**
 * H1 rep 2, the day-1 evening close-the-loop prompt
 * (plans/2026-07-21-chat-first-onboarding.md §6.3, §9 Phase 2). The
 * measured cliff is real: 5 of 48 claimed real families have ever
 * produced a loop-back event (§12), and the fix the spec calls for is
 * naming the sitting-1 artifact by name, that same evening, not a
 * generic nudge.
 *
 * This rides the same hourly dispatcher tick as the built-in task
 * kinds (agent/schedules/dispatch.ts) but deliberately bypasses their
 * recurring agent_schedules machinery: no schedule row, no
 * advance/claim semantics. It is a single boundary event, exactly like
 * the other onboarding beats already tracked in
 * context.onboarding.beatsDone (start_first_making already appends
 * "first_making" the moment the job starts), not a repeating cadence.
 * Firing is idempotent because beatsDone is append-only and this
 * module's caller appends "sitting1_recap" right after a successful
 * send, so a family can never be found eligible twice.
 *
 * Eligibility requires a genuinely COMPLETED making with a real
 * materials row, never just a started job: a job still building has
 * nothing to name yet, and the honest move is to wait for the next
 * tick rather than invent a promise (BUILD.md tool-honesty law).
 */

const EVENING_LOCAL_HOUR = 19;
/** Generous enough to cover a late-starting sitting one without ever
 * reading as a stray delayed send days later: past this, "today" would
 * no longer be true. */
const MAX_FAMILY_AGE_HOURS = 30;

export interface DueSitting1Recap {
  familyId: string;
  timeZone: string;
  email: string | null;
  phoneNumbers: string[];
  parentFirstName: string | null;
  recipientMemberUserId: string | null;
  artifactTitle: string;
  childName: string | null;
}

interface CandidateRow {
  id: string;
  time_zone: string;
  email: string | null;
  first_name: string | null;
  parent_display_name: string | null;
  owner_user_id: string | null;
}

/** The confirmed artifact for a family's first making, or null when no
 * completed job has landed a real materials row yet. Never built from
 * the job's own title alone; the materials row is the confirmation. */
async function readCompletedFirstMaking(
  sql: Sql,
  familyId: string,
): Promise<{ title: string; childName: string | null } | null> {
  const rows = await sql<
    { material_title: string | null; child_name: string | null }[]
  >`
    select m.title as material_title, c.name as child_name
    from public.agent_jobs j
    join public.agent_job_stage_artifacts a
      on a.job_id = j.id and a.family_id = j.family_id and a.kind = 'material'
    join public.materials m
      on m.id = a.material_id and m.family_id = j.family_id
      and m.status <> 'superseded'
    left join public.children c
      on c.id = j.child_id and c.family_id = j.family_id
    where j.family_id = ${familyId}
      and j.start_idempotency_key like 'first-making:%'
      and j.status = 'completed'
    order by j.created_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row || !row.material_title) return null;
  return { title: row.material_title, childName: row.child_name };
}

/** localHourOf duplicated in miniature rather than imported from
 * lib/tasks/time.ts: that module's version is tied to the recurring
 * schedule's DST-safe walk, and pulling the whole file in here for one
 * hour read would blur why this beat carries no agent_schedules row. */
function localHourOf(zone: string, at: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    hour12: false,
  }).format(at);
  return Number.parseInt(hour, 10) % 24;
}

/** Every onboarding family whose first-making artifact is confirmed
 * ready, whose local evening has arrived, still inside her first day,
 * who has not already received this recap. Callers must append
 * "sitting1_recap" to beatsDone immediately after a successful send. */
export async function findFamiliesDueForSitting1RecapWithDatabase(
  sql: Sql,
  now: Date,
): Promise<DueSitting1Recap[]> {
  const candidates = await sql<CandidateRow[]>`
    select f.id, f.time_zone, f.email, f.first_name, f.parent_display_name,
      (select m.user_id from public.family_members m
       where m.family_id = f.id order by m.created_at limit 1) as owner_user_id
    from public.families f
    where f.email is not null
      and f.time_zone is not null
      and f.created_at > now() - make_interval(hours => ${MAX_FAMILY_AGE_HOURS})
      and (f.context -> 'onboarding') is not null
      and (f.context -> 'onboarding' -> 'beatsDone') @> '["first_making"]'::jsonb
      and not (f.context -> 'onboarding' -> 'beatsDone') @> '["sitting1_recap"]'::jsonb
  `;
  const due: DueSitting1Recap[] = [];
  for (const candidate of candidates) {
    if (localHourOf(candidate.time_zone, now) < EVENING_LOCAL_HOUR) continue;
    const artifact = await readCompletedFirstMaking(sql, candidate.id);
    if (!artifact) continue;
    const phones = await sql<{ phone_e164: string }[]>`
      select phone_e164 from public.family_phones where family_id = ${candidate.id}
      order by created_at
    `;
    due.push({
      familyId: candidate.id,
      timeZone: candidate.time_zone,
      email: candidate.email,
      phoneNumbers: phones.map((row) => row.phone_e164),
      parentFirstName: candidate.parent_display_name ?? candidate.first_name,
      recipientMemberUserId: candidate.owner_user_id,
      artifactTitle: artifact.title,
      childName: artifact.childName,
    });
  }
  return due;
}

/** The dispatcher's kickoff instruction for one recap send. Composed
 * here, not in lib/tasks/dispatch-input.ts, because this beat carries
 * no FamilyTaskKind and no DueFamilyTask: it never enters that
 * module's exhaustive switch. */
export function buildSitting1RecapMessage(recap: DueSitting1Recap): string {
  return [
    "It is the evening of her first day with Homa.",
    `Compose one short close-the-loop message to ${recap.parentFirstName ?? "the parent"} that names "${recap.artifactTitle}" by title${
      recap.childName ? ` for ${recap.childName}` : ""
    }, says it is in her Binder, and asks one easy question about how today actually went.`,
    "One to two sentences, your own voice. Never invent anything beyond the named making; if nothing else comes to mind, the question about her day is enough on its own.",
    "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.",
  ].join("\n");
}
