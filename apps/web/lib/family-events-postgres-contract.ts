import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";
import type { Sql, TransactionSql } from "postgres";

import {
  expandRecurringFamilyEvents,
  familyEventChildIds,
  getFamilyEventCaller,
  listFamilyEventsCaller,
  listFamilyEventsPinned,
  type FamilyEventRow,
} from "./family-events";
import { EVAL_ONBOARDING_FIXTURE_FAMILY_ID } from "./family-context-eval-fixture";
import { mapDb } from "./map/db";
import {
  createMonthPlanDraft,
  reviseMonthPlanDraft,
  verifyMonthPlanDraft,
  type MonthPlanConflict,
  type ProposedMonthPlan,
} from "./month-plan-draft";

const FAMILY = "11040000-0000-4000-8000-0000000000f1";
const CHILDREN = [
  { id: "11040000-0000-4000-8000-0000000000c1", name: "Avery" },
  { id: "11040000-0000-4000-8000-0000000000c2", name: "Blair" },
  { id: "11040000-0000-4000-8000-0000000000c3", name: "Casey" },
];
const IDS = {
  coOp: "11040000-0000-4000-8000-0000000000e1",
  future: "11040000-0000-4000-8000-0000000000e2",
  trip: "11040000-0000-4000-8000-0000000000e3",
  alternating: "11040000-0000-4000-8000-0000000000e4",
  single: "11040000-0000-4000-8000-0000000000e5",
  boundary: "11040000-0000-4000-8000-0000000000e6",
  outside: "11040000-0000-4000-8000-0000000000e7",
  foreign: "11040000-0000-4000-8000-0000000000e8",
};
const FROM = "2026-09-01";
const TO = "2026-09-30";
const DATES = [1, 2, 7, 8, 10, 11, 14, 15, 16, 21, 28, 30].map((day) =>
  `2026-09-${String(day).padStart(2, "0")}`,
);

async function authenticated<T>(sql: Sql, userId: string, operation: (tx: TransactionSql) => Promise<T>) {
  return await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`set local role authenticated`;
    return operation(tx);
  }) as T;
}

/** The real Supabase client builds each request. This narrow SELECT-only
 * fetch adapter executes those filters against real PostgreSQL as the caller.
 * It covers query construction and RLS, not a deployed PostgREST HTTP server. */
function callerOnPostgres(sql: Sql, userId: string) {
  const tables = new Set(["family_events", "family_event_children", "family_event_occurrence_exceptions"]);
  const columns = new Set([
    "id", "family_id", "child_id", "event_id", "title", "starts_on", "ends_on",
    "start_time", "end_time", "note", "recurrence_rule", "created_at", "occurrence_on", "kind",
  ]);
  return createClient("http://recurrence-test.invalid", "synthetic-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      assert.equal(options?.method ?? "GET", "GET");
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1)!;
      assert.ok(tables.has(table), `unexpected table ${table}`);
      assert.ok(url.searchParams.has("family_id"), "every read must pin its family");
      const quote = (column: string) => {
        assert.ok(columns.has(column), `unexpected column ${column}`);
        return `"${column}"`;
      };
      const values: string[] = [];
      const bind = (value: string) => { values.push(value); return `$${values.length}`; };
      const filter = (column: string, expression: string): string => {
        const field = quote(column);
        if (expression === "not.is.null") return `${field} is not null`;
        if (expression.startsWith("in.(") && expression.endsWith(")")) {
          return `${field} in (${expression.slice(4, -1).split(",").map(bind).join(",")})`;
        }
        const match = /^(eq|lte|gte)\.(.+)$/u.exec(expression);
        assert.ok(match, `unexpected filter ${expression}`);
        const operator = { eq: "=", lte: "<=", gte: ">=" }[match[1] as "eq" | "lte" | "gte"];
        return `${field} ${operator} ${bind(match[2])}`;
      };
      const selected = url.searchParams.get("select")!.split(",").map((column) => quote(column.trim()));
      const where: string[] = [];
      for (const [key, value] of url.searchParams) {
        if (key === "select" || key === "order") continue;
        if (key === "or") {
          assert.ok(value.startsWith("(") && value.endsWith(")"));
          where.push(`(${value.slice(1, -1).split(",").map((part) => {
            const dot = part.indexOf(".");
            return filter(part.slice(0, dot), part.slice(dot + 1));
          }).join(" or ")})`);
        } else {
          where.push(filter(key, value));
        }
      }
      const order = url.searchParams.get("order");
      if (order) assert.equal(order, "starts_on.asc");
      const query = `select ${selected.join(",")} from public."${table}" where ${where.join(" and ")}`
        + (order ? " order by starts_on asc" : "");
      // Let PostgreSQL encode dates as JSON strings, like PostgREST, before
      // postgres.js can parse date columns into JavaScript Date objects.
      const [result] = await authenticated(sql, userId, async (tx) => await tx.unsafe<{ rows: unknown[] }[]>(
        `select coalesce(jsonb_agg(to_jsonb(candidate)), '[]'::jsonb) as rows from (${query}) candidate`,
        values,
      ));
      const rows = result.rows;
      const single = new Headers(options?.headers).get("accept")?.includes("vnd.pgrst.object+json");
      return Response.json(single ? rows[0] ?? null : rows);
    } },
  });
}

function plan(): ProposedMonthPlan {
  return {
    monthStart: FROM, title: "September fixture", unscheduledItems: [],
    children: CHILDREN.map((child) => ({
      childId: child.id, childName: child.name, targets: ["Read together"], unresolvedChoices: [],
      weeks: [1, 2, 3, 4].map((week) => ({
        week, focus: "Reading",
        activities: DATES.slice((week - 1) * 3, week * 3).map((scheduledDate) => ({
          text: `Read on ${scheduledDate}`, scheduledDate, reusedMaterialId: null,
        })),
      })),
    })),
  };
}

function sortedConflicts(conflicts: MonthPlanConflict[]) {
  return conflicts.map((entry) => [entry.childId, entry.childName, entry.scheduledDate, entry.activity, entry.commitment])
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function expectedConflicts(revised: boolean): MonthPlanConflict[] {
  const facts = [
    { title: "Family trip", dates: [1, 2], children: CHILDREN },
    { title: "Alternating camp", dates: [1, 2, 14, 15, 16], children: CHILDREN },
    { title: "Monday co-op", dates: revised ? [15] : [15, 28], children: CHILDREN.slice(0, 2) },
    { title: "Future co-op", dates: revised ? [8] : [10, 11], children: CHILDREN.slice(0, 2) },
    { title: "Boundary camp", dates: [1], children: CHILDREN.slice(2) },
    { title: "Casey's appointment", dates: [30], children: CHILDREN.slice(2) },
  ];
  return facts.flatMap((fact) => fact.children.flatMap((child) => fact.dates.map((day) => {
    const scheduledDate = `2026-09-${String(day).padStart(2, "0")}`;
    return { childId: child.id, childName: child.name, scheduledDate,
      activity: `Read on ${scheduledDate}`, commitment: fact.title };
  })));
}

function semantics(events: FamilyEventRow[]) {
  return events.map((event) => ({ ...event, createdAt: new Date(event.createdAt).toISOString() }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function runRecurringMonthPlanConflictContract(sql: Sql, parentId: string) {
  assert.ok(process.env.HOMA_EVAL_DATABASE_URL, "disposable database required");
  assert.equal(process.env.VERCEL, undefined, "never run this probe in a deployment");
  const selected = CHILDREN.slice(0, 2).map((child) => child.id);
  const weekly = { frequency: "weekly", interval: 1, weekdays: [1], until: "2026-09-28" };
  const events = [
    { id: IDS.coOp, title: "Monday co-op", start: "2026-08-03", end: "2026-08-03", rule: weekly, children: selected },
    { id: IDS.future, title: "Future co-op", start: "2026-10-01", end: "2026-10-01",
      rule: { ...weekly, weekdays: [4], until: "2026-10-08" }, children: selected },
    { id: IDS.trip, title: "Family trip", start: "2026-08-31", end: "2026-09-02", rule: null, children: [] },
    { id: IDS.alternating, title: "Alternating camp", start: "2026-08-31", end: "2026-09-02",
      rule: { ...weekly, interval: 2, until: "2026-09-14" }, children: [] },
    { id: IDS.single, title: "Casey's appointment", start: TO, end: TO, rule: null, children: [CHILDREN[2].id] },
    { id: IDS.boundary, title: "Boundary camp", start: "2026-11-02", end: "2026-11-04",
      rule: { ...weekly, until: "2026-11-02" }, children: [CHILDREN[2].id] },
    { id: IDS.outside, title: "Later appointment", start: "2026-10-12", end: "2026-10-12", rule: null, children: [] },
  ];
  await sql`insert into public.families (id, name, us_state) values (${FAMILY}, 'Recurrence fixture', 'VA')`;
  await sql`insert into public.family_members (family_id, user_id, role) values (${FAMILY}, ${parentId}, 'parent')`;
  for (const child of CHILDREN) {
    await sql`insert into public.children (id, family_id, name, birth_month)
      values (${child.id}, ${FAMILY}, ${child.name}, '2020-01-01')`;
  }
  for (const event of events) {
    await authenticated(sql, parentId, async (tx) => {
      await tx`select public.save_family_event_with_children(
        'create', ${event.id}::uuid, ${FAMILY}::uuid, ${event.title},
        ${event.start}::date, ${event.end}::date, null::time, null::time, null::text,
        ${event.rule ? tx.json(event.rule) : null}::jsonb, ${tx.array(event.children)}::uuid[]
      )`;
    });
  }
  await sql`insert into public.family_events (id, family_id, title, starts_on, ends_on, recurrence_rule)
    values (${IDS.foreign}, ${EVAL_ONBOARDING_FIXTURE_FAMILY_ID}, 'Foreign future event',
      '2026-10-01', '2026-10-01', ${sql.json({ ...weekly, weekdays: [4], until: null })})`;
  await sql`insert into public.family_event_occurrence_exceptions
    (family_id, event_id, occurrence_on, kind, starts_on, ends_on)
    values (${EVAL_ONBOARDING_FIXTURE_FAMILY_ID}, ${IDS.foreign}, '2026-10-01', 'moved', '2026-09-10', '2026-09-10')`;

  async function exception(eventId: string, occurrenceOn: string, start: string | null, end = start) {
    await authenticated(sql, parentId, async (tx) => {
      await tx`select public.save_family_event_occurrence_exception(
        ${eventId}::uuid, ${FAMILY}::uuid, ${occurrenceOn}::date,
        ${start ? "moved" : "cancelled"}, ${start}::date, ${end}::date, null::time, null::time
      )`;
    });
  }
  await exception(IDS.coOp, "2026-09-07", null);
  await exception(IDS.coOp, "2026-09-14", "2026-09-15");
  await exception(IDS.coOp, "2026-09-21", "2026-10-02");
  await exception(IDS.future, "2026-10-01", "2026-09-10", "2026-09-11");
  await exception(IDS.boundary, "2026-11-02", "2026-08-31", "2026-09-01");

  async function snapshot() {
    const [row] = await sql<{ state: unknown }[]>`select jsonb_build_object(
      'events', (select jsonb_agg(to_jsonb(event) order by id) from public.family_events event),
      'audience', (select jsonb_agg(to_jsonb(link) order by event_id, child_id) from public.family_event_children link),
      'exceptions', (select jsonb_agg(to_jsonb(exception) order by event_id, occurrence_on)
        from public.family_event_occurrence_exceptions exception)
    ) as state`;
    return row.state;
  }

  try {
    // Reproduce the old candidate predicate's actual SQL loss before asserting
    // the new readers. The exception above was accepted by the real RPC.
    const oldCandidates = await sql<{ id: string }[]>`select id from public.family_events
      where family_id = ${FAMILY} and starts_on <= ${TO}
        and (ends_on >= ${FROM} or recurrence_rule is not null)`;
    assert.ok(!oldCandidates.some((event) => event.id === IDS.future || event.id === IDS.boundary));
    const oldMonthRows = await sql<{ id: string }[]>`select id from public.family_events
      where family_id = ${FAMILY} and starts_on <= ${TO} and ends_on >= ${FROM}`;
    assert.ok(!oldMonthRows.some((event) => event.id === IDS.coOp));
    const before = await snapshot();
    const caller = callerOnPostgres(sql, parentId);
    const pinned = await listFamilyEventsPinned(FAMILY, FROM, TO);
    const ownRows = await listFamilyEventsCaller(caller, FAMILY, FROM, TO);
    assert.deepEqual(ownRows.map((event) => event.id).sort(), [
      IDS.coOp, IDS.future, IDS.trip, IDS.alternating, IDS.single, IDS.boundary,
    ].sort());
    assert.deepEqual(semantics(ownRows), semantics(pinned));
    assert.deepEqual(semantics(expandRecurringFamilyEvents(ownRows, FROM, TO)),
      semantics(expandRecurringFamilyEvents(pinned, FROM, TO)));
    assert.deepEqual(familyEventChildIds(ownRows.find((event) => event.id === IDS.future)!), selected);
    assert.deepEqual(familyEventChildIds(ownRows.find((event) => event.id === IDS.trip)!), []);
    assert.deepEqual(await listFamilyEventsCaller(caller, EVAL_ONBOARDING_FIXTURE_FAMILY_ID, FROM, TO), []);
    assert.equal(await getFamilyEventCaller(caller, FAMILY, IDS.foreign), null);
    assert.ok(!pinned.some((event) => event.familyId !== FAMILY));
    console.log("PASS  caller RLS and pinned candidates include moved-in series with identical occurrences and audience");

    const sessionId = "recurring-month-plan-local-session";
    const secret = "synthetic-local-month-plan-secret";
    const created = await createMonthPlanDraft({ familyId: FAMILY, sessionId, secret, plan: plan() });
    assert.deepEqual(sortedConflicts(created.preview.conflicts), sortedConflicts(expectedConflicts(false)));
    assert.deepEqual(await snapshot(), before, "preview generation must not change any event, audience or exception");
    assert.ok(verifyMonthPlanDraft(created.draftToken, sessionId, FAMILY, { secret }));
    console.log("PASS  actual create preview returns exact recurrence/date/child/title conflicts without event writes");

    // Changes are fixture setup between previews. Revise must re-read them,
    // while the original signed draft remains a historical revision.
    await exception(IDS.coOp, "2026-09-28", null);
    await exception(IDS.future, "2026-10-01", "2026-09-08");
    const beforeRevise = await snapshot();
    const revised = await reviseMonthPlanDraft({ familyId: FAMILY, sessionId, secret,
      draftToken: created.draftToken, plan: { ...plan(), title: "September revised fixture" } });
    assert.ok(revised);
    assert.equal(revised.preview.draftId, created.preview.draftId);
    assert.equal(revised.preview.revision, 2);
    assert.deepEqual(sortedConflicts(revised.preview.conflicts), sortedConflicts(expectedConflicts(true)));
    assert.deepEqual(await snapshot(), beforeRevise);
    const history = verifyMonthPlanDraft(revised.draftToken, sessionId, FAMILY, { secret })!.history;
    assert.deepEqual(sortedConflicts(history[0].conflicts), sortedConflicts(expectedConflicts(false)));
    assert.deepEqual(sortedConflicts(history[1].conflicts), sortedConflicts(expectedConflicts(true)));
    console.log("PASS  actual revise refreshes conflicts and preserves the signed prior revision without event writes");
  } finally {
    await mapDb().end({ timeout: 5 });
  }
}
