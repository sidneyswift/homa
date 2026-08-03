import assert from "node:assert/strict";

import postgres, { type TransactionSql } from "postgres";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_PARENT_USER_ID,
  EVAL_ONBOARDING_FIXTURE_FAMILY_ID,
} from "../apps/web/lib/family-context-eval-fixture";

/**
 * End-to-end proof for one-date changes to a recurring family event.
 * eval:sandbox supplies a disposable database with every real migration, so
 * this checks the same constraints, RLS grants, and security-definer RPC that
 * the web and mobile Planner call in production.
 */

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run this probe through pnpm test:family-event-occurrences:postgres");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });

const SERIES_ID = "00000000-0000-4000-8000-0000000000e1";
const FOREIGN_SERIES_ID = "00000000-0000-4000-8000-0000000000e2";
const SECOND_PARENT_ID = "00000000-0000-4000-8000-0000000000b0";

async function asAuthenticated<T>(
  userId: string,
  operation: (transaction: TransactionSql) => Promise<T>,
): Promise<T> {
  return await sql.begin(async (transaction) => {
    await transaction`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await transaction`set local role authenticated`;
    return await operation(transaction);
  }) as T;
}

async function saveException(
  transaction: TransactionSql,
  input: {
    eventId: string;
    familyId: string;
    occurrenceOn: string;
    kind: "cancelled" | "moved";
    startsOn?: string;
    endsOn?: string;
    startTime?: string;
    endTime?: string;
  },
): Promise<string> {
  const [row] = await transaction<{ receipt: string }[]>`
    select public.save_family_event_occurrence_exception(
      ${input.eventId}::uuid,
      ${input.familyId}::uuid,
      ${input.occurrenceOn}::date,
      ${input.kind},
      ${input.startsOn ?? null}::date,
      ${input.endsOn ?? null}::date,
      ${input.startTime ?? null}::time,
      ${input.endTime ?? null}::time
    )::text as receipt
  `;
  return row.receipt;
}

try {
  await sql`
    insert into public.family_events (
      id, family_id, title, starts_on, ends_on, start_time, end_time,
      recurrence_rule
    ) values (
      ${SERIES_ID}, ${EVAL_FIXTURE_FAMILY_ID}, 'Monday co-op',
      '2026-08-03', '2026-08-03', '09:00', '10:00',
      ${sql.json({ frequency: "weekly", interval: 1, weekdays: [1], until: null })}
    ), (
      ${FOREIGN_SERIES_ID}, ${EVAL_ONBOARDING_FIXTURE_FAMILY_ID},
      'Other family co-op', '2026-08-03', '2026-08-03', '11:00', '12:00',
      ${sql.json({ frequency: "weekly", interval: 1, weekdays: [1], until: null })}
    )
  `;

  const occurrenceTruth = await sql<{ occurrence_on: string; belongs: boolean }[]>`
    select occurrence_on::text, public.is_family_event_occurrence(
      ${sql.json({ frequency: "weekly", interval: 2, weekdays: [1, 3], until: null })},
      '2026-08-03'::date,
      occurrence_on
    ) as belongs
    from unnest(array[
      '2026-08-03'::date,
      '2026-08-05'::date,
      '2026-08-10'::date,
      '2026-08-17'::date
    ]) occurrence_on
    order by occurrence_on
  `;
  assert.deepEqual(
    occurrenceTruth.map((row) => row.belongs),
    [true, true, false, true],
  );
  console.log("PASS  database recognizes only real weekly occurrences");

  const movedReceipt = await asAuthenticated(EVAL_FIXTURE_PARENT_USER_ID, async (transaction) =>
    await saveException(transaction, {
      eventId: SERIES_ID,
      familyId: EVAL_FIXTURE_FAMILY_ID,
      occurrenceOn: "2026-08-10",
      kind: "moved",
      startsOn: "2026-08-11",
      endsOn: "2026-08-11",
      startTime: "13:30",
      endTime: "14:30",
    }),
  );
  assert.equal(movedReceipt, "2026-08-10");

  const [moved] = await asAuthenticated(
    EVAL_FIXTURE_PARENT_USER_ID,
    async (transaction) => await transaction<{
      kind: string;
      occurrence_on: string;
      starts_on: string;
      start_time: string;
    }[]>`
      select kind, occurrence_on::text, starts_on::text,
             to_char(start_time, 'HH24:MI') as start_time
      from public.family_event_occurrence_exceptions
      where event_id = ${SERIES_ID}
    `,
  );
  assert.deepEqual(moved, {
    kind: "moved",
    occurrence_on: "2026-08-10",
    starts_on: "2026-08-11",
    start_time: "13:30",
  });
  console.log("PASS  a member can move one date with an exact receipt");

  const cancelledReceipt = await asAuthenticated(
    EVAL_FIXTURE_PARENT_USER_ID,
    async (transaction) => await saveException(transaction, {
      eventId: SERIES_ID,
      familyId: EVAL_FIXTURE_FAMILY_ID,
      occurrenceOn: "2026-08-10",
      kind: "cancelled",
    }),
  );
  assert.equal(cancelledReceipt, "2026-08-10");
  const [cancelled] = await sql<{ kind: string; starts_on: string | null }[]>`
    select kind, starts_on::text
    from public.family_event_occurrence_exceptions
    where event_id = ${SERIES_ID}
  `;
  assert.deepEqual(cancelled, { kind: "cancelled", starts_on: null });
  console.log("PASS  deleting one date replaces its move without touching the series");

  await assert.rejects(
    asAuthenticated(EVAL_FIXTURE_PARENT_USER_ID, async (transaction) =>
      await saveException(transaction, {
        eventId: SERIES_ID,
        familyId: EVAL_FIXTURE_FAMILY_ID,
        occurrenceOn: "2026-08-11",
        kind: "cancelled",
      }),
    ),
    /occurrence is not in this series/u,
  );

  for (const statement of [
    (transaction: TransactionSql) => transaction`
      insert into public.family_event_occurrence_exceptions (
        family_id, event_id, occurrence_on, kind
      ) values (${EVAL_FIXTURE_FAMILY_ID}, ${SERIES_ID}, '2026-08-17', 'cancelled')
    `,
    (transaction: TransactionSql) => transaction`
      update public.family_event_occurrence_exceptions
      set kind = 'cancelled'
      where event_id = ${SERIES_ID}
    `,
    (transaction: TransactionSql) => transaction`
      delete from public.family_event_occurrence_exceptions
      where event_id = ${SERIES_ID}
    `,
  ]) {
    await assert.rejects(
      asAuthenticated(EVAL_FIXTURE_PARENT_USER_ID, statement),
      /permission denied/u,
    );
  }
  console.log("PASS  authenticated clients cannot bypass the scoped RPC");

  await sql`
    insert into auth.users (id, email)
    values (${SECOND_PARENT_ID}, 'occurrence-boundary@homatest.invalid')
  `;
  await sql`
    insert into public.family_members (family_id, user_id, role)
    values (${EVAL_FIXTURE_FAMILY_ID}, ${SECOND_PARENT_ID}, 'parent')
  `;
  await asAuthenticated(EVAL_FIXTURE_PARENT_USER_ID, async (transaction) =>
    await saveException(transaction, {
      eventId: FOREIGN_SERIES_ID,
      familyId: EVAL_ONBOARDING_FIXTURE_FAMILY_ID,
      occurrenceOn: "2026-08-10",
      kind: "cancelled",
    }),
  );

  await assert.rejects(
    asAuthenticated(SECOND_PARENT_ID, async (transaction) =>
      await saveException(transaction, {
        eventId: FOREIGN_SERIES_ID,
        familyId: EVAL_ONBOARDING_FIXTURE_FAMILY_ID,
        occurrenceOn: "2026-08-10",
        kind: "cancelled",
      }),
    ),
    /family is not available to this member/u,
  );
  const foreignRows = await asAuthenticated(
    SECOND_PARENT_ID,
    async (transaction) => await transaction`
      select event_id
      from public.family_event_occurrence_exceptions
      where family_id = ${EVAL_ONBOARDING_FIXTURE_FAMILY_ID}
    `,
  );
  assert.equal(foreignRows.length, 0);
  console.log("PASS  write and read boundaries reject another family's occurrence");

  await sql`delete from public.family_events where id = ${SERIES_ID}`;
  const [cascade] = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from public.family_event_occurrence_exceptions
    where event_id = ${SERIES_ID}
  `;
  assert.equal(cascade.count, 0);
  console.log("PASS  deleting the series cascades its dated exceptions");
} finally {
  await sql.end({ timeout: 5 });
}
