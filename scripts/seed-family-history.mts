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

import {
  HISTORY_PROFILES,
  type HistoryProfile,
} from "../apps/web/lib/compliance/family-history-fixture";

import { buildFamilyHistorySql } from "./family-history-sql.mts";

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.printSql) {
    if (args.familyId) {
      throw new Error(
        "--print-sql cannot read an existing family's children; drop --family-id",
      );
    }
    const { sql, summary } = buildFamilyHistorySql(args);
    console.log(`Family history fixture\n  ${summary}\n`);
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
    // An existing family's history must reference its real children.
    let childIds: string[] | undefined;
    if (args.familyId) {
      const children = await client<{ id: string }[]>`
        select id
        from public.children
        where family_id = ${args.familyId}::uuid
        order by created_at, id
      `;
      if (children.length === 0) {
        throw new Error("--family-id names a family with no children");
      }
      childIds = children.map((child) => child.id);
    }
    const { sql, familyId, summary } = buildFamilyHistorySql({
      ...args,
      children: childIds?.length ?? args.children,
      childIds,
    });
    console.log(`Family history fixture\n  ${summary}\n`);
    await client.unsafe(sql);
    console.log(`Seeded family ${familyId}.`);
    if (sandboxUrl) console.log("Target: disposable eval sandbox.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

await main();
