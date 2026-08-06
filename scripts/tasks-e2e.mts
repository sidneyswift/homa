/**
 * Live E2E for the task framework (HT-1..HT-6 acceptance): a synthetic
 * family against the REAL dev agent + homa-prod, driven through the eve
 * dev dispatch route, then cascade-cleaned. Mirrors the gateway plan's
 * GW-6 E2E discipline.
 *
 * Prereqs: a dev server running with the flags on, e.g.
 *   cd apps/web && MORNING_BRIEF_ENABLED=true JOURNAL_PROMPT_ENABLED=true \
 *     FLEET_RESEARCH_ENABLED=true RESEARCH_TOPICS_PER_NIGHT=1 \
 *     pnpm exec next dev -p 3222
 *
 * Usage: pnpm tsx scripts/tasks-e2e.mts -- --base http://localhost:3222 [--keep] [--skip-fleet]
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD, RESEND_API_KEY, gateway creds).
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when env arrives from the shell.
}

// Env must load before these modules read it (usage-report.mts pattern).
const { mapDb } = await import("../apps/web/lib/map/db");
const { createCustomTask, setTaskPaused } = await import("../apps/web/lib/tasks/custom");
const { localHourOf } = await import("../apps/web/lib/tasks/time");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}
const BASE = argValue("--base") ?? "http://localhost:3222";
const KEEP = process.argv.includes("--keep");
const SKIP_FLEET = process.argv.includes("--skip-fleet");

const sql = mapDb();
const startedAt = new Date();
const failures: string[] = [];
function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

/** A zone where the wall clock is 9am or 10am right now, so the brief's
 * 9-to-noon send window is genuinely open (no test back doors). */
function pickBriefZone(now: Date): string | null {
  const candidates = [
    "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
    "America/Denver", "America/Chicago", "America/New_York",
    "America/Sao_Paulo", "Atlantic/Azores", "UTC", "Europe/Paris",
    "Europe/Moscow", "Asia/Dubai", "Asia/Karachi", "Asia/Dhaka",
    "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
    "Pacific/Auckland",
  ];
  for (const zone of candidates) {
    const hour = localHourOf(zone, now);
    if (hour === 9 || hour === 10) return zone;
  }
  return null;
}

async function fireSchedule(name: string): Promise<void> {
  const response = await fetch(`${BASE}/eve/v1/dev/schedules/${name}`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`dev dispatch of ${name} failed: HTTP ${response.status}`);
  }
}

async function waitFor<T>(
  label: string,
  probe: () => Promise<T | null>,
  timeoutMs: number,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.error(`timeout waiting for: ${label}`);
  return null;
}

const zone = pickBriefZone(startedAt);
if (!zone) {
  console.error("No candidate zone has a 9-10am wall clock right now; run at another time.");
  process.exit(2);
}
console.log(`Using zone ${zone} (local hour ${localHourOf(zone, startedAt)}) · base ${BASE}\n`);

// Pre-flight: refuse to run over pre-existing schedule rows. A prior
// dev session's seeded rows can hold PAST next_run_at values, and this
// script's dev server runs with every flag on, so firing the dispatcher
// would claim them and message REAL families (it happened, 2026-07-10:
// three families got late-evening journal emails). Zero rows is the
// honest baseline while the prod flags stay dark.
const preExisting = await sql<{ count: string }[]>`
  select count(*)::text as count from public.agent_schedules
`;
if (Number(preExisting[0].count) > 0) {
  console.error(
    `agent_schedules already holds ${preExisting[0].count} row(s). Clean them up (or explain them) before running this E2E; firing the dispatcher over unknown due rows can message real families.`,
  );
  await sql.end();
  process.exit(2);
}

// ---- 1. Synthetic family (created 2 days ago so seeding gates pass) ----
const familyRows = await sql<{ id: string }[]>`
  insert into public.families
    (name, us_state, parent_display_name, first_name, email, time_zone,
     profile_completed_at, created_at, context, status, sandbox)
  values
    ('E2E Tasks Family', 'TX', 'Evie', 'Evie', 'delivered@resend.dev', ${zone},
     now(), now() - interval '2 days',
     ${sql.json({ styles: ["montessori"], curriculums: ["Heggerty"] } as never)},
     'claimed', true)
  returning id
`;
const familyId = familyRows[0].id;
console.log(`family ${familyId}`);

const childRows = await sql<{ id: string }[]>`
  insert into public.children (family_id, name, birth_month, profile)
  values (${familyId}, 'Nova', '2022-06-01',
          ${sql.json({ interests: ["dinosaurs"], focus: "letter sounds" } as never)})
  returning id
`;
const childId = childRows[0].id;

await sql`
  insert into public.child_reports (child_id, scores, bank_version)
  values (${childId}, ${sql.json({
    subjects: [
      {
        subjectId: "phonics",
        position: "ahead",
        monthsAhead: 8,
        strongestObservedStatement: "Knows most letter sounds",
        frontierStatement: "Blends two sounds into a little word",
      },
      { subjectId: "math", position: "on_track", monthsAhead: 0 },
    ],
    mappedCount: 2,
    totalSubjects: 16,
  } as never)}, '2026.07.5')
`;
await sql`
  insert into public.family_memories (family_id, child_id, kind, content, source)
  values (${familyId}, ${childId}, 'what_works', 'Dino-themed anything doubles Nova''s focus', 'homa')
`;

try {
  // ---- 2. Seeding: first dispatch tick creates the built-in rows ----
  await fireSchedule("dispatch");
  const seeded = await sql<{ id: string; kind: string }[]>`
    select id, kind from public.agent_schedules where family_id = ${familyId}
  `;
  const briefRow = seeded.find((row) => row.kind === "morning_brief");
  report("seeding created a morning_brief row", Boolean(briefRow));
  report(
    "seeding created a journal_prompt row",
    seeded.some((row) => row.kind === "journal_prompt"),
  );
  if (!briefRow) throw new Error("no brief row; cannot continue");

  // ---- 3. The morning brief runs end to end (email path, no phone) ----
  await sql`
    update public.agent_schedules set next_run_at = now() - interval '1 minute'
    where id = ${briefRow.id}
  `;
  await fireSchedule("dispatch");
  const briefRun = await waitFor(
    "morning brief run to finish",
    async () => {
      const rows = await sql<
        { id: string; status: string; summary: string | null; delivered_channel: string | null }[]
      >`
        select id, status, summary, delivered_channel from public.homa_task_runs
        where family_id = ${familyId} and kind = 'morning_brief'
          and status in ('done', 'failed')
      `;
      return rows[0] ?? null;
    },
    180_000,
  );
  report("brief run finished 'done'", briefRun?.status === "done", briefRun?.status ?? "missing");
  report(
    "brief has composed text",
    Boolean(briefRun?.summary && briefRun.summary.length > 20),
    briefRun?.summary?.slice(0, 60) ?? "empty",
  );
  report(
    "brief delivered by email (no phone linked)",
    briefRun?.delivered_channel === "email",
    briefRun?.delivered_channel ?? "null",
  );
  if (briefRun?.summary) {
    console.log(`\n--- the brief ---\n${briefRun.summary}\n-----------------\n`);
    report("brief carries no em dash", !briefRun.summary.includes("\u2014"));
    report(
      "brief carries no banned framing",
      !/\b(behind|delayed?|disorder|diagnos\w*|percentile)\b/i.test(briefRun.summary),
    );
  }
  const briefEvents = await sql<{ props: { channel?: string } }[]>`
    select props from public.events
    where name = 'research.brief_sent' and props->>'family_id' = ${familyId}
  `;
  report("research.brief_sent event emitted", briefEvents.length === 1);
  const dispatchMessages = await sql<{ role: string }[]>`
    select role from public.conversation_messages
    where family_id = ${familyId} and channel = 'dispatch'
  `;
  report(
    "brief session persisted to the durable record",
    dispatchMessages.some((row) => row.role === "assistant"),
  );

  // ---- 4. At-least-once: a forced redelivery is a same-day no-op ----
  await sql`
    update public.agent_schedules set next_run_at = now() - interval '1 minute'
    where id = ${briefRow.id}
  `;
  await fireSchedule("dispatch");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const briefRunCount = await sql<{ count: string }[]>`
    select count(*)::text as count from public.homa_task_runs
    where family_id = ${familyId} and kind = 'morning_brief'
  `;
  report(
    "outbox absorbed the redelivery (still one brief run today)",
    Number(briefRunCount[0].count) === 1,
    `count=${briefRunCount[0].count}`,
  );

  // ---- 5. Custom task, save-only delivery ----
  const created = await createCustomTask(
    familyId,
    {
      label: "Co-op prep note",
      prompt: "Write Evie a one-sentence reminder to pack Nova's co-op bag tonight.",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      localHour: localHourOf(zone, new Date()),
      deliveryPref: "none",
    },
    "parent",
  );
  report("custom task created through the store", created.ok, created.ok ? "" : created.note);
  if (created.ok) {
    await sql`
      update public.agent_schedules set next_run_at = now() - interval '1 minute'
      where id = ${created.id}
    `;
    await fireSchedule("dispatch");
    const customRun = await waitFor(
      "custom run to finish",
      async () => {
        const rows = await sql<
          { status: string; summary: string | null; delivered_channel: string | null }[]
        >`
          select status, summary, delivered_channel from public.homa_task_runs
          where family_id = ${familyId} and kind = 'custom' and status in ('done', 'failed')
        `;
        return rows[0] ?? null;
      },
      120_000,
    );
    report("custom run finished 'done'", customRun?.status === "done", customRun?.status ?? "missing");
    report(
      "custom run saved without sending (delivery 'none')",
      customRun?.delivered_channel === "none",
      customRun?.delivered_channel ?? "null",
    );
  }

  // ---- 6. The pause switch stops the next morning ----
  const paused = await setTaskPaused(familyId, briefRow.id, true);
  report("pause toggle accepted", paused.ok);
  await sql`
    update public.agent_schedules set next_run_at = now() - interval '1 minute'
    where id = ${briefRow.id}
  `;
  await fireSchedule("dispatch");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const afterPause = await sql<{ count: string }[]>`
    select count(*)::text as count from public.homa_task_runs
    where family_id = ${familyId} and kind = 'morning_brief'
  `;
  report(
    "paused task did not run",
    Number(afterPause[0].count) === 1,
    `count=${afterPause[0].count}`,
  );

  // ---- 7. Fleet research: real web research through the gate ----
  if (!SKIP_FLEET) {
    await fireSchedule("fleet-research");
    const fleetRun = await waitFor(
      "fleet research run to finish",
      async () => {
        const rows = await sql<{ id: string; status: string; summary: string | null }[]>`
          select id, status, summary from public.homa_task_runs
          where kind = 'fleet_research' and started_at >= ${startedAt.toISOString()}
            and status in ('done', 'failed')
          order by started_at desc
        `;
        return rows[0] ?? null;
      },
      300_000,
    );
    report(
      "fleet research run finished 'done'",
      fleetRun?.status === "done",
      `${fleetRun?.status ?? "missing"}: ${fleetRun?.summary ?? ""}`,
    );
    if (fleetRun) {
      const rows = await sql<
        { topic_key: string; status: string; citations: unknown[] }[]
      >`
        select topic_key, status, citations from public.knowledge_bank
        where run_id = ${fleetRun.id}
      `;
      report(
        "research merged an active, cited row",
        rows.some((row) => row.status === "active" && row.citations.length > 0),
        rows.map((row) => `${row.topic_key}:${row.status}`).join(",") || "no rows",
      );
      console.log(
        `fleet rows: ${rows.map((row) => `${row.topic_key} (${row.status}, ${row.citations.length} citations)`).join("; ") || "none"}`,
      );
    }
  }
} finally {
  if (!KEEP) {
    // ---- Cleanup: cascade the family; sweep fleet rows + events ----
    const fleetRuns = await sql<{ id: string }[]>`
      select id from public.homa_task_runs
      where kind = 'fleet_research' and started_at >= ${startedAt.toISOString()}
    `;
    for (const run of fleetRuns) {
      await sql`delete from public.knowledge_bank where run_id = ${run.id}`;
      await sql`delete from public.homa_task_runs where id = ${run.id}`;
    }
    await sql`delete from public.families where id = ${familyId}`;
    // Seeding also created dormant rows for real families (this dev run
    // had the flags on; prod does not yet). Sweep them: they reseed
    // within an hour of the real founder flag flip.
    await sql`
      delete from public.agent_schedules
      where created_at >= ${startedAt.toISOString()} and family_id != ${familyId}
    `;
    await sql`
      delete from public.events
      where created_at >= ${startedAt.toISOString()}
        and (props->>'family_id' = ${familyId}
             or name in ('tasks.run_completed', 'knowledge.row_merged'))
    `;
    console.log("\ncleanup complete (synthetic family cascaded, fleet rows swept)");
  } else {
    console.log(`\nkept: family ${familyId}`);
  }
}

console.log(failures.length === 0 ? "\nALL E2E CHECKS PASSED" : `\nFAILURES: ${failures.length}`);
await sql.end();
process.exit(failures.length === 0 ? 0 : 1);
