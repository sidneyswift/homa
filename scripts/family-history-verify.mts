import { installHoursPostgresFixture } from "./hours-postgres-fixture.mjs";
/**
 * Proves a seeded family history reads back the way the product will
 * see it (gh#343). Run inside the disposable sandbox, after seeding:
 *
 *   pnpm eval:sandbox --exec pnpm tsx --tsconfig ./tsconfig.json \
 *     ../../scripts/family-history-verify.mts
 *
 * It seeds a year-long family, then queries the rows back through plain
 * SQL shaped like the hours page's own reads, so a fixture that inserts
 * cleanly but totals wrong cannot pass quietly.
 */

import { randomUUID } from "node:crypto";

import { generateFamilyHistory } from "../apps/web/lib/compliance/family-history-fixture";

const url = process.env.HOMA_EVAL_DATABASE_URL;
if (!url) {
  console.error("HOMA_EVAL_DATABASE_URL is unset; run inside pnpm eval:sandbox.");
  process.exit(2);
}

const postgres = (await import("postgres")).default;
const sql = postgres(url, { max: 1 });
await installHoursPostgresFixture(sql);

const asOf = new Date("2026-07-28T00:00:00Z");
const history = generateFamilyHistory({ profile: "year1", childCount: 2, asOf });
const familyId = randomUUID();
const childIds = [randomUUID(), randomUUID()];

await sql`
  insert into public.families (id, name, us_state, status, profile_completed_at, sandbox)
  values (${familyId}, 'Verify', 'PA', 'claimed', now(), true)
`;
for (const [index, childId] of childIds.entries()) {
  await sql`
    insert into public.children (id, family_id, name, birth_month)
    values (${childId}, ${familyId}, ${`Kid${index + 1}`}, date '2016-05-04')
  `;
}
for (const row of history.hours) {
  await sql`
    insert into homa_test_fixture.hours_log
      (family_id, child_id, subject, minutes, happened_on, source, note)
    values (${familyId}, ${row.childIndex === null ? null : childIds[row.childIndex]},
            ${row.subject}, ${row.minutes}, ${row.happenedOn}, ${row.source}, ${row.note})
  `;
}

const [{ rows, minutes, days }] = await sql<
  { rows: number; minutes: number; days: number }[]
>`
  select count(*)::int as rows,
         coalesce(sum(minutes), 0)::int as minutes,
         count(distinct happened_on)::int as days
  from public.hours_log where family_id = ${familyId}
`;

// The schema comment's rule: a family-wide row (child_id null) counts
// toward EVERY child's total, so a per-child view must include them.
// Mapped by the generator's own child order, never by uuid sort: the
// index is the contract between generator and seeder, and sorting by
// id silently pairs the wrong totals (caught by this check, 2026-07-28).
const perChild: { child_id: string; minutes: number }[] = [];
for (const childId of childIds) {
  const [row] = await sql<{ minutes: number }[]>`
    select coalesce(sum(minutes), 0)::int as minutes
    from public.hours_log
    where family_id = ${familyId}
      and (child_id = ${childId} or child_id is null)
  `;
  perChild.push({ child_id: childId, minutes: row.minutes });
}

const bySubject = await sql<{ subject: string; minutes: number }[]>`
  select subject, sum(minutes)::int as minutes
  from public.hours_log where family_id = ${familyId}
  group by subject order by minutes desc
`;

const problems: string[] = [];
if (rows !== history.totals.rows) {
  problems.push(`row count ${rows} != generated ${history.totals.rows}`);
}
if (minutes !== history.totals.minutes) {
  problems.push(`minutes ${minutes} != generated ${history.totals.minutes}`);
}
if (days !== history.totals.distinctDays) {
  problems.push(`days ${days} != generated ${history.totals.distinctDays}`);
}
for (const [index, child] of perChild.entries()) {
  const expected =
    history.totals.perChildMinutes[index] + history.totals.familyWideMinutes;
  if (child.minutes !== expected) {
    problems.push(`child ${index} read ${child.minutes} != expected ${expected}`);
  }
}
if (bySubject.length < 5) {
  problems.push(`only ${bySubject.length} subjects appeared; expected a real mix`);
}

console.log(`read back: ${rows} rows, ${(minutes / 60).toFixed(1)}h, ${days} days`);
console.log(
  `per child (family-wide included): ${perChild.map((c) => `${(c.minutes / 60).toFixed(1)}h`).join(", ")}`,
);
console.log(`subjects: ${bySubject.map((s) => `${s.subject} ${(s.minutes / 60).toFixed(1)}h`).join(", ")}`);

await sql.end({ timeout: 5 });

if (problems.length > 0) {
  console.error(`FAILED:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("family history verified end to end.");
