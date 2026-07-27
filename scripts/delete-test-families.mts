#!/usr/bin/env tsx
/**
 * Retires families created by the dev test-session harness
 * (apps/web/app/api/dev/test-session/route.ts).
 *
 * Walking onboarding end to end means signing up, and signing up leaves
 * a family behind. They are all sandbox by construction (the harness
 * generates a +homatest address and the store marks those at the account
 * moment), so they are already fenced out of funnels, physical mail and
 * the founder's alerts. This is the tidy-up so they do not pile up in
 * the console.
 *
 * Same soft delete the founder console uses: status = 'deleted', which
 * every reader already filters, plus the rows that must not outlive a
 * family (agent_schedules, or the dispatcher keeps texting from beyond
 * the grave). attachAuthUser skips deleted families when it picks a fold
 * target, so the alias stays reusable.
 *
 * Refuses to touch anything that is not both sandbox AND matching the
 * harness's own email shape. A misclick here would be deleting a real
 * family, so there is no flag that widens it.
 *
 * Usage:
 *   tsx scripts/delete-test-families.mts            # dry run, prints what it would do
 *   tsx scripts/delete-test-families.mts --apply    # actually retires them
 */
import { mapDb } from "../apps/web/lib/map/db.ts";

/** Exactly what generateTestEmail() in the harness produces. */
const HARNESS_EMAIL = "%+homatest%@example.invalid";

const apply = process.argv.includes("--apply");

const sql = mapDb();

const candidates = await sql<
  { id: string; email: string | null; created_at: string; msgs: number }[]
>`
  select f.id, f.email, f.created_at::text as created_at,
         (select count(*)::int from public.conversation_messages m
          where m.family_id = f.id) as msgs
  from public.families f
  where f.sandbox
    and f.status <> 'deleted'
    and f.email like ${HARNESS_EMAIL}
  order by f.created_at
`;

if (candidates.length === 0) {
  console.log("No harness families to retire.");
  process.exit(0);
}

console.log(`${candidates.length} harness famil${candidates.length === 1 ? "y" : "ies"}:`);
for (const family of candidates) {
  console.log(`  ${family.id}  ${family.created_at}  ${family.msgs} messages`);
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to retire them.");
  process.exit(0);
}

let retired = 0;
for (const family of candidates) {
  const done = await sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update public.families
      set status = 'deleted', updated_at = now()
      where id = ${family.id} and sandbox and status <> 'deleted'
      returning id
    `;
    if (rows.length === 0) return false;
    await tx`delete from public.agent_schedules where family_id = ${family.id}`;
    return true;
  });
  if (done) retired += 1;
}

console.log(`\nRetired ${retired} of ${candidates.length}.`);
process.exit(0);
