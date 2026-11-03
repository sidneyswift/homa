/**
 * SQL for the family time machine (gh#343), shared by
 * scripts/seed-family-history.mts and the local stack's established
 * persona (scripts/local-stack.mts). Pure: builds statements, writes
 * nothing.
 */

import { randomUUID } from "node:crypto";

import {
  generateFamilyHistory,
  type HistoryProfile,
} from "../apps/web/lib/compliance/family-history-fixture";

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableUuid(value: string | null): string {
  return value ? sqlString(value) : "null";
}

/** Child birthdays that put kids in a plausible K-8 band for the
 * reference date, spaced two years apart. Full dates on purpose: these
 * are collected values in the fixture's own story, so the prep sheet may
 * print them (prefillBirthdate's window rule applies to real rows). */
function childBirthdate(asOf: Date, index: number): string {
  const year = asOf.getUTCFullYear() - 7 - index * 2;
  const month = ((index * 5) % 12) + 1;
  const day = ((index * 7) % 27) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const CHILD_NAMES = ["Ada", "Mateo", "Juno", "Sam", "Perla", "Wren", "Ike", "Noor"];

export interface FamilyHistorySqlInput {
  profile: HistoryProfile;
  state: string;
  children: number;
  familyName: string;
  seed: number;
  asOf: Date;
  /** An existing family to add history to; omit to create one. */
  familyId: string | null;
  /**
   * The existing family's children, oldest first. Required with familyId:
   * history rows reference real children, never invented ids.
   */
  childIds?: readonly string[];
}

export function buildFamilyHistorySql(
  args: FamilyHistorySqlInput,
): { sql: string; familyId: string; summary: string } {
  if (args.familyId && (!args.childIds || args.childIds.length !== args.children)) {
    throw new Error(
      "an existing family's history needs its real child ids, one per child",
    );
  }
  const history = generateFamilyHistory({
    profile: args.profile,
    childCount: args.children,
    asOf: args.asOf,
    seed: args.seed,
  });
  const familyId = args.familyId ?? randomUUID();
  const childIds = args.childIds
    ? [...args.childIds]
    : Array.from({ length: args.children }, () => randomUUID());
  const statements: string[] = [];

  if (!args.familyId) {
    const email = `homa.dev+homatest-${args.profile}-${familyId.slice(0, 8)}@example.invalid`;
    statements.push(`insert into public.families
  (id, name, us_state, parent_display_name, first_name, last_name, email,
   time_zone, status, profile_completed_at, sandbox, created_at)
values
  (${sqlString(familyId)}, ${sqlString(args.familyName)}, ${sqlString(args.state)},
   ${sqlString("Robin")}, ${sqlString("Robin")}, ${sqlString(args.familyName)},
   ${sqlString(email)}, ${sqlString("America/New_York")}, 'claimed', now(), true,
   now() - interval '${Math.round(history.shape.months * 30.4)} days');`);

    childIds.forEach((childId, index) => {
      statements.push(`insert into public.children (id, family_id, name, birth_month, created_at)
values (${sqlString(childId)}, ${sqlString(familyId)}, ${sqlString(CHILD_NAMES[index] ?? `Kid${index + 1}`)},
        date ${sqlString(childBirthdate(args.asOf, index))},
        now() - interval '${Math.round(history.shape.months * 30.4)} days' + interval '${index} minutes');`);
    });
  }

  // Fixture provenance is explicit and independent for every synthetic entry.
  const fixtureHours = history.hours.map((row) => ({ row, id: randomUUID(), operationId: randomUUID() }));
  if (fixtureHours.length > 0) {
    const claims = fixtureHours.map(({ row, id, operationId }) =>
      `(${sqlString(operationId)}, ${sqlString(familyId)}, ${sqlString(`synthetic-history:${id}`)}, jsonb_build_object('fixtureHoursId', ${sqlString(id)}::text), array[${sqlString(id)}::uuid], date ${sqlString(row.happenedOn)})`).join(",\n");
    statements.push(`insert into public.learning_write_operations(id,family_id,operation_key,request,expected_hours_ids,resolved_date) values ${claims};`);
    const hoursValues = fixtureHours.map(({ row, id, operationId }) => {
      const childId = row.childIndex === null ? null : childIds[row.childIndex];
      return `(${sqlString(id)}, ${sqlString(familyId)}, ${sqlNullableUuid(childId)}, ${sqlString(row.subject)}, ${row.minutes}, date ${sqlString(row.happenedOn)}, ${sqlString(row.source)}, ${sqlString(row.note)}, (date ${sqlString(row.happenedOn)} + time '17:30')::timestamptz, ${sqlString(operationId)})`;
    }).join(",\n");
    statements.push(`insert into public.hours_log(id,family_id,child_id,subject,minutes,happened_on,source,note,created_at,capture_operation_id) values ${hoursValues};`);
    statements.push(`update public.learning_write_operations set outcome=jsonb_build_object('hoursEntryIds',to_jsonb(expected_hours_ids)) where id in (${fixtureHours.map(({ operationId }) => sqlString(operationId)).join(",")});`);
  }

  const memoryValues = history.memories
    .map((memory) => {
      const childId =
        memory.childIndex === null ? null : childIds[memory.childIndex];
      return `  (${sqlString(familyId)}, ${sqlNullableUuid(childId)}, ${sqlString(memory.kind)}, ${sqlString(memory.content)}, 'parent', now() - interval '${memory.daysAgo} days')`;
    })
    .join(",\n");
  if (memoryValues) {
    statements.push(`insert into public.family_memories
  (family_id, child_id, kind, content, source, created_at)
values
${memoryValues};`);
  }

  const hoursTotal = (history.totals.minutes / 60).toFixed(1);
  const perChild = history.totals.perChildMinutes
    .map((minutes, index) => `${CHILD_NAMES[index] ?? index}: ${(minutes / 60).toFixed(1)}h`)
    .join(", ");
  const summary = [
    `profile      ${args.profile} (${history.shape.label})`,
    `family       ${args.familyName}, ${args.state}, ${args.children} children`,
    `hours rows   ${history.totals.rows} across ${history.totals.distinctDays} days`,
    `total time   ${hoursTotal}h (${perChild}; family-wide ${(history.totals.familyWideMinutes / 60).toFixed(1)}h)`,
    `memories     ${history.memories.length}`,
  ].join("\n  ");

  return { sql: ["begin;", ...statements, "commit;"].join("\n\n"), familyId, summary };
}
