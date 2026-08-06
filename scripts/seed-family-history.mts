/**
 * The family time machine (gh#343): seed a family that looks like it has
 * used Homa for a month, a quarter, half a year, or a full school year.
 *
 * Usage, from the repo root:
 *   pnpm seed:family-history --profile year1 --state PA --children 2
 *   pnpm seed:family-history --profile month3 --print-sql
 *
 * Every fixture Homa had described a family on its first day, so the
 * surfaces whose value IS accumulated history (the hours page's
 * school-year total, a full Binder, the evidence report in gh#317) were
 * only ever seen empty. This writes the rows to make them real.
 *
 * Where it writes, in order of preference:
 *   1. HOMA_EVAL_DATABASE_URL, the disposable eval sandbox cluster
 *      (pnpm eval:sandbox --exec ...), which is the safe default.
 *   2. --print-sql, which emits the statements and writes nothing.
 * A production write needs --confirm-prod AND a +homatest family id,
 * because prod test families must be sandbox-flagged (prod test family
 * hygiene: an unflagged test family's email failures become founder
 * console alerts).
 *
 * Determinism: the generator is seeded and the reference date is passed
 * in, so re-running with the same arguments produces the same family.
 */

import { randomUUID } from "node:crypto";

import {
  generateFamilyHistory,
  HISTORY_PROFILES,
  type HistoryProfile,
} from "../apps/web/lib/compliance/family-history-fixture";

interface Args {
  profile: HistoryProfile;
  state: string;
  children: number;
  familyName: string;
  seed: number;
  asOf: Date;
  printSql: boolean;
  confirmProd: boolean;
  familyId: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
  };
  const profile = (get("--profile") ?? "month3") as HistoryProfile;
  if (!HISTORY_PROFILES.includes(profile)) {
    throw new Error(
      `--profile must be one of ${HISTORY_PROFILES.join(", ")}; got ${profile}`,
    );
  }
  const children = Number(get("--children") ?? 2);
  if (!Number.isInteger(children) || children < 1 || children > 8) {
    throw new Error("--children must be an integer from 1 to 8");
  }
  const asOfRaw = get("--as-of");
  const asOf = asOfRaw ? new Date(`${asOfRaw}T00:00:00Z`) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    throw new Error("--as-of must be YYYY-MM-DD");
  }
  return {
    profile,
    state: (get("--state") ?? "PA").toUpperCase(),
    children,
    familyName: get("--family-name") ?? "Rivera",
    seed: Number(get("--seed") ?? 20260728),
    asOf,
    printSql: argv.includes("--print-sql"),
    confirmProd: argv.includes("--confirm-prod"),
    familyId: get("--family-id"),
  };
}

function sqlString(value: string): string {
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

function buildSql(args: Args): { sql: string; familyId: string; summary: string } {
  const history = generateFamilyHistory({
    profile: args.profile,
    childCount: args.children,
    asOf: args.asOf,
    seed: args.seed,
  });
  const familyId = args.familyId ?? randomUUID();
  const childIds = Array.from({ length: args.children }, () => randomUUID());
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

  const hoursValues = history.hours
    .map((row) => {
      const childId = row.childIndex === null ? null : childIds[row.childIndex];
      return `  (${sqlString(familyId)}, ${sqlNullableUuid(childId)}, ${sqlString(row.subject)}, ${row.minutes}, date ${sqlString(row.happenedOn)}, ${sqlString(row.source)}, ${sqlString(row.note)}, (date ${sqlString(row.happenedOn)} + time '17:30')::timestamptz)`;
    })
    .join(",\n");
  if (hoursValues) {
    statements.push(`insert into public.hours_log
  (family_id, child_id, subject, minutes, happened_on, source, note, created_at)
values
${hoursValues};`);
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

  return { sql: statements.join("\n\n"), familyId, summary };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { sql, familyId, summary } = buildSql(args);

  console.log(`Family history fixture\n  ${summary}\n`);

  if (args.printSql) {
    console.log(sql);
    return;
  }

  const sandboxUrl = process.env.HOMA_EVAL_DATABASE_URL;
  if (!sandboxUrl && !args.confirmProd) {
    console.log(
      [
        "Nothing was written. Pick a target:",
        "  sandbox: run inside the disposable cluster, which is the safe default",
        "    pnpm eval:sandbox --exec pnpm seed:family-history --profile year1",
        "  print:   emit SQL and write nothing",
        "    pnpm seed:family-history --profile year1 --print-sql",
        "  prod:    a sandbox-flagged +homatest family only, deliberately",
        "    pnpm seed:family-history --profile year1 --confirm-prod",
      ].join("\n"),
    );
    process.exitCode = 2;
    return;
  }

  const postgres = (await import("postgres")).default;
  const connectionString = sandboxUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "No database URL. Set HOMA_EVAL_DATABASE_URL (sandbox) or DATABASE_URL with --confirm-prod.",
    );
  }
  const client = postgres(connectionString, { max: 1 });
  try {
    if (!sandboxUrl && args.familyId) {
      const target = await client<{ sandbox: boolean; email: string | null }[]>`
        select sandbox, email
        from public.families
        where id = ${args.familyId}::uuid
      `;
      const family = target[0];
      if (
        !family?.sandbox ||
        !family.email ||
        !/\+homatest[^@]*@/iu.test(family.email)
      ) {
        throw new Error(
          "--family-id may target only an existing sandbox +homatest family in production",
        );
      }
    }
    await client.unsafe(sql);
    console.log(`Seeded family ${familyId}.`);
    if (sandboxUrl) console.log("Target: disposable eval sandbox.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

await main();
