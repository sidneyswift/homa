/**
 * Final ChildProgress rollout reconciliation.
 *
 * Usage:
 *   HOMA_PROGRESS_DATABASE_URL=postgres://... pnpm progress:reconcile
 *   HOMA_PROGRESS_DATABASE_URL=postgres://... pnpm progress:reconcile -- --dry-run
 *
 * This command never loads an environment file and never runs automatically.
 */
import postgres from "postgres";

import {
  executeChildProgressReconciliation,
  type ChildProgressReconciliationDatabase,
} from "./reconcile-child-progress-lib";

function parseDryRun(arguments_: string[]): boolean {
  const unknown = arguments_.filter(
    (argument) =>
      argument !== "--dry-run" && argument !== "--",
  );
  if (unknown.length > 0) {
    throw new TypeError(
      `Unknown reconciliation argument: ${unknown.join(", ")}`,
    );
  }
  return arguments_.includes("--dry-run");
}

async function main(): Promise<void> {
  const databaseUrl = process.env.HOMA_PROGRESS_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "HOMA_PROGRESS_DATABASE_URL is required. This command does not load environment files.",
    );
  }
  const dryRun = parseDryRun(process.argv.slice(2));
  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 15,
  });
  const database: ChildProgressReconciliationDatabase = {
    async withTransaction(operation) {
      const wrapped = await sql.begin(async (transactionSql) => ({
        value: await operation({
          async acquireExclusiveLock(lockKey) {
            await transactionSql`
              select pg_advisory_xact_lock(${lockKey}::bigint)
            `;
          },
          async reconcile() {
            const rows = await transactionSql<
              {
                inserted_count: string;
                superseded_count: string;
              }[]
            >`
              select inserted_count::text, superseded_count::text
              from private.reconcile_child_answers_to_progress()
            `;
            const row = rows[0];
            if (!row) {
              throw new Error(
                "ChildProgress reconciliation returned no counts",
              );
            }
            return {
              insertedCount: BigInt(row.inserted_count),
              supersededCount: BigInt(row.superseded_count),
            };
          },
        }),
      }));
      return wrapped.value;
    },
  };

  try {
    const result = await executeChildProgressReconciliation({
      database,
      dryRun,
    });
    console.log(`mode=${result.mode}`);
    console.log(`inserted_count=${result.insertedCount}`);
    console.log(`superseded_count=${result.supersededCount}`);
    console.log(`status=${result.status}`);
    console.log(
      `safe_to_continue_rollout=${result.mode === "commit"}`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "ChildProgress reconciliation failed",
  );
  process.exitCode = 1;
});
