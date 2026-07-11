/**
 * One-action fleet-wide revert for the knowledge bank (HT-2, the M3-04
 * requirement): flags every ACTIVE row a given research run produced, so
 * a bad night disappears from every family's brief inputs at once.
 * Rows are never deleted; flagged history is the audit trail, and any
 * superseded predecessors are restored to active so the corpus never
 * loses its last good entry.
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-revert.mts --run <homa_task_runs uuid> [--reason "why"] --confirm-prod
 *
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD).
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { assertConfirmedProdWrite } from "./prod-write-guard.mts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI or when env arrives from the shell.
}

// Env must load before the db module reads it (usage-report.mts pattern).
const { mapDb } = await import("../apps/web/lib/map/db");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const runId = argValue("--run");
const reason = argValue("--reason") ?? "reverted by scripts/knowledge-revert.mts";
if (!runId || !/^[0-9a-f-]{36}$/i.test(runId)) {
  console.error("Usage: pnpm tsx scripts/knowledge-revert.mts --run <uuid> [--reason \"why\"] --confirm-prod");
  process.exit(2);
}

assertConfirmedProdWrite({
  scriptName: "knowledge-revert",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

const sql = mapDb();

const flagged = await sql<{ id: string; topic_type: string; topic_key: string }[]>`
  update public.knowledge_bank
  set status = 'flagged', flagged_reason = ${reason}, updated_at = now()
  where run_id = ${runId} and status = 'active'
  returning id, topic_type, topic_key
`;

let restored = 0;
for (const row of flagged) {
  const predecessors = await sql<{ id: string }[]>`
    update public.knowledge_bank
    set status = 'active', superseded_by = null, updated_at = now()
    where superseded_by = ${row.id} and status = 'superseded'
    returning id
  `;
  restored += predecessors.length;
}

console.log(
  `Flagged ${flagged.length} row(s) from run ${runId}` +
    (flagged.length > 0
      ? ` (${flagged.map((row) => `${row.topic_type}/${row.topic_key}`).join(", ")})`
      : "") +
    `; restored ${restored} superseded predecessor(s).`,
);
await sql.end();
