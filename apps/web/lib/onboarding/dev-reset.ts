import { mapDb } from "../map/db";
import { attachAuthUser, startAnonymousFamily } from "../map/store";

/**
 * Start onboarding over as the same person.
 *
 * Testing this flow means arriving as somebody who has never been here,
 * over and over. Making a new account each time costs a new login, a new
 * bookmark, and a pile of abandoned families; what is wanted is one
 * account you keep and a button that puts it back to before.
 *
 * So: retire the current family, and attach this account to a fresh one.
 *
 * The first version hard-deleted the family and let the schema's own
 * ON DELETE CASCADE clear the forty tables hanging off it. That looked
 * elegant and returned a 500 on the first real click. The reason is
 * worth writing down, because it is an easy trap to fall into twice: a
 * cascade is TRANSITIVE, and the survey that justified the approach only
 * looked at tables referencing families and children DIRECTLY. One level
 * further out (whatever references conversation_episodes, or
 * subject_lessons, or materials) a single ON DELETE NO ACTION is enough
 * to block the whole delete, and those are invisible to the survey that
 * made the plan look safe.
 *
 * The soft delete has no such failure mode. It is one UPDATE, it is what
 * the founder console's own delete already does, every reader filters
 * status = 'deleted', and attachAuthUser deliberately skips deleted
 * families when it looks for a fold target, so the retired family cannot
 * come back and adopt the new one's children. Rows accumulate, which for
 * a development loop is the right trade, and
 * scripts/delete-test-families.mts sweeps them when it matters.
 *
 * Refuses anything that is not a sandbox family. The caller's family is
 * resolved from their own session, so there is no id to pass and nothing
 * to mistype.
 */

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

  // The guard and the retirement are the same statement: the predicate
  // is what makes a real household impossible to reach from here, so it
  // belongs in the write rather than in a check before it.
  const retired = await sql<{ id: string }[]>`
    update public.families
    set status = 'deleted', updated_at = now()
    where id = ${input.familyId} and sandbox and status <> 'deleted'
    returning id
  `;
  if (retired.length === 0) {
    const existing = await sql<{ sandbox: boolean }[]>`
      select sandbox from public.families where id = ${input.familyId}
    `;
    if (!existing[0]) throw new Error("reset: no such family");
    if (!existing[0].sandbox) {
      throw new Error("reset: refusing, this is not a test family");
    }
    // Already retired: a double click, or a reset that half-finished.
    // Falling through gives this account a fresh family either way,
    // which is the point of pressing the button.
  }

  // The one thing that must not outlive a family: a schedule keeps the
  // dispatcher texting and emailing a household that is gone.
  await sql`delete from public.agent_schedules where family_id = ${input.familyId}`;

  // The membership goes too, and this one is not housekeeping.
  //
  // A soft-deleted family leaves its family_members row behind, so an
  // account reset eleven times is a member of eleven families. Anything
  // that resolves a family by asking "which family is this user in" then
  // has eleven answers and no reason to prefer the live one. The eve
  // channel picked a retired family that way, and the founder spent a
  // walk watching Homa answer about a child from three resets ago while
  // the page showed a family that had none.
  //
  // The resolver is fixed too (agent/channels/eve.ts filters deleted
  // families), but leaving the rows would keep the harness generating
  // the exact state the fix has to survive, and a test account is worth
  // more when it looks like a real one: exactly one family.
  await sql`
    delete from public.family_members
    where user_id = ${input.authUserId} and family_id = ${input.familyId}
  `;

  const { familyId: freshId } = await startAnonymousFamily({
    source: "organic",
    utm: {},
    sandbox: true,
  });
  const { familyId, resumeToken } = await attachAuthUser({
    familyId: freshId,
    authUserId: input.authUserId,
    email: input.email,
  });

  // The first insert is already sandboxed, attachAuthUser preserves that from
  // the email alias, and this final stamp keeps reset idempotent even for an
  // older test account created before either protection existed.
  await sql`update public.families set sandbox = true where id = ${familyId}`;

  return { previousFamilyId: input.familyId, familyId, resumeToken };
}
