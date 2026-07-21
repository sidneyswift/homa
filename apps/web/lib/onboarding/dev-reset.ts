import { mapDb } from "../map/db";
import { attachAuthUser, startAnonymousFamily } from "../map/store";

/**
 * Start onboarding over as the same person.
 *
 * Testing this flow means walking it, and walking it means arriving as
 * somebody who has never been here. Making a new account every time
 * costs a new login, a new bookmark, and a pile of abandoned families;
 * what is actually wanted is one account you keep, and a button that
 * puts it back to before.
 *
 * So this deletes the family and re-attaches the SAME auth user to a
 * fresh one. That sounds heavier than wiping a few columns, and it is
 * the safer of the two: almost every table in the schema hangs off
 * families with ON DELETE CASCADE, so one delete clears forty of them
 * and cannot drift. Hand-listing the tables instead would rot quietly,
 * because the table somebody adds next month leaves residue nobody
 * notices until a "fresh" family remembers something.
 *
 * Three tables use NO ACTION and would block the delete instead of
 * following it. They are cleared first, by name, and that is the whole
 * maintenance burden: if a fourth appears, this fails loudly with a
 * foreign-key violation rather than silently leaving a trace.
 *
 * Refuses anything that is not a sandbox family. The caller's family is
 * resolved from their session, so there is no id to pass and nothing to
 * mistype.
 */

/** Tables that would block a family delete rather than follow it. */
const BLOCKING_TABLES = [
  "conversation_signals",
  "knowledge_gaps",
  "response_engagement",
] as const;

export interface OnboardingResetResult {
  previousFamilyId: string;
  familyId: string;
  /** The only time this value exists in plaintext: the column stores a
   *  hash, so the caller has to set the cookie from here or not at all. */
  resumeToken: string;
}

export async function resetOnboardingFamily(input: {
  familyId: string;
  authUserId: string;
  email: string;
}): Promise<OnboardingResetResult> {
  const sql = mapDb();

  const guard = await sql<{ sandbox: boolean }[]>`
    select sandbox from public.families where id = ${input.familyId}
  `;
  if (!guard[0]) throw new Error("reset: no such family");
  if (!guard[0].sandbox) {
    // The one thing that must never happen. A non-sandbox family is a
    // real household, and this function deletes forty tables.
    throw new Error("reset: refusing, this is not a test family");
  }

  await sql.begin(async (tx) => {
    for (const table of BLOCKING_TABLES) {
      await tx`delete from ${tx(table)} where family_id = ${input.familyId}`;
    }
    // The cascade does the rest: children and their answers, reports and
    // plans, the transcript, episodes and deliveries, materials,
    // memories, hours, schedules, jobs, attachments, snapshots.
    await tx`delete from public.families where id = ${input.familyId}`;
  });

  const { familyId: freshId } = await startAnonymousFamily({
    source: "organic",
    utm: {},
  });
  const { familyId, resumeToken } = await attachAuthUser({
    familyId: freshId,
    authUserId: input.authUserId,
    email: input.email,
  });

  // attachAuthUser marks sandbox from the email alias. Stamping it here
  // too means a family reset once can always be reset again, whatever
  // address it was created with.
  await sql`update public.families set sandbox = true where id = ${familyId}`;

  return { previousFamilyId: input.familyId, familyId, resumeToken };
}
