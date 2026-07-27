import { listFamilyDeliveryRecipients } from "../conversation-continuity/delivery-ledger";
import { mapDb } from "../map/db";
import { submitHomaSms } from "../voice/telnyx-api";

/**
 * Parent-facing milestone delivery for agent jobs (agent-jobs runner spec).
 * When a build gates a volume for review, finishes, or parks for attention,
 * the parent should hear about it, not have to ask. Two surfaces, both
 * best-effort so a delivery failure never breaks the durable job transition:
 *   1. A homa_task_runs row (kind 'agent_job'), which shows up in the
 *      parent's existing /app/tasks history feed. This is the durable,
 *      always-visible record, even for a family with no texting line.
 *   2. A short SMS to the family's linked phone, so an active build reaches
 *      her without opening the app.
 *
 * Honest voice: sentence case, no em dash, reassure then inform, an offer
 * never a command (Homa copy law).
 */

export type JobMilestoneKind = "gate" | "completed" | "needs_attention";

export interface JobMilestoneInput {
  familyId: string;
  childId: string | null;
  title: string;
  kind: JobMilestoneKind;
  /** The job's stage count; a one-stage making words its milestones as
   * one thing, never "every part". */
  totalStages?: number;
}

async function childFirstName(familyId: string, childId: string | null): Promise<string | null> {
  if (!childId) return null;
  const sql = mapDb();
  const rows = await sql<{ name: string | null }[]>`
    select name from public.children where id = ${childId} and family_id = ${familyId}
  `;
  const name = rows[0]?.name?.trim();
  return name ? name.split(/\s+/)[0] : null;
}

/**
 * Whether the job's label already opens with the child's possessive (or a
 * generic "your"), so the body template must not prepend it a second time.
 * start_agent_job's own tool description asks the model for a label like
 * "Theo's All About Reading plan", so this is the common case, not an edge
 * case: prod's first two agent_job rows both doubled on it ("Story's
 * Story's alphabet search-and-find set...").
 */
function startsWithPossessive(title: string, childName: string | null): boolean {
  const normalized = title.trimStart().replace(/’/g, "'");
  if (childName) {
    const prefix = `${childName}'s`;
    if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rest = normalized.slice(prefix.length);
      if (rest.length === 0 || /^\s/.test(rest)) return true;
    }
  }
  return /^your(\s|$)/i.test(normalized);
}

export function compose(
  kind: JobMilestoneKind,
  title: string,
  childName: string | null,
  totalStages = 2,
): { title: string; body: string } {
  const who = childName ? `${childName}'s` : "your";
  const subject = startsWithPossessive(title, childName) ? title : `${who} ${title}`;
  const onePiece = totalStages === 1;
  if (kind === "gate") {
    return {
      title: `First part of ${title} is ready`,
      body: `Good news: the first part of ${subject} is ready to look over in the Binder. Have a look, and when you are happy, just tell me to keep going and I will build the rest.`,
    };
  }
  if (kind === "completed") {
    return {
      title: `${title} is all done`,
      body: onePiece
        ? `${subject} is ready. It is saved in the Binder and waiting in your Homa chat too.`
        : `${subject} is finished. Every part is saved in the Binder, ready whenever you are.`,
    };
  }
  return {
    title: `${title} needs a quick look`,
    body: onePiece
      ? `The build for ${subject} hit a snag and paused. Nothing is lost. Want me to try it again?`
      : `The build for ${subject} hit a snag and paused. Everything already built is safe in the Binder. Want me to try the rest again?`,
  };
}

/**
 * Deliver a milestone and return the homa_task_runs id (for linking as a
 * job's completion_task_run_id). Never throws: both surfaces are wrapped so
 * a transport or write failure only logs.
 */
export async function deliverJobMilestone(input: JobMilestoneInput): Promise<string | null> {
  const childName = await childFirstName(input.familyId, input.childId).catch(() => null);
  const { title, body } = compose(
    input.kind,
    input.title,
    childName,
    input.totalStages ?? 2,
  );

  let deliveredChannel: "sms" | "none" = "none";
  try {
    const recipients = await listFamilyDeliveryRecipients(input.familyId);
    const phone = recipients.flatMap((r) => r.phoneNumbers).find(Boolean);
    if (phone) {
      const result = await submitHomaSms(phone, body);
      if (result.status !== "rejected") deliveredChannel = "sms";
    }
  } catch (error) {
    console.error("deliverJobMilestone SMS failed:", error);
  }

  try {
    const sql = mapDb();
    const rows = await sql<{ id: string }[]>`
      insert into public.homa_task_runs
        (family_id, kind, status, title, summary, delivered_channel, finished_at)
      values (${input.familyId}, 'agent_job', 'done', ${title.slice(0, 120)},
              ${body.slice(0, 4000)}, ${deliveredChannel}, now())
      returning id
    `;
    return rows[0]?.id ?? null;
  } catch (error) {
    console.error("deliverJobMilestone run record failed:", error);
    return null;
  }
}
