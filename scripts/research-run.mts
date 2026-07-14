/**
 * Start fleet research on demand through the production-equivalent eve
 * channel. Any repo-aware agent can use this command without knowing the
 * runtime's private route shape.
 *
 * Usage:
 *   pnpm research:run -- --count 10 --wait --confirm-prod
 *   pnpm research:run -- --cell curriculum:dimensions-math:all --wait --confirm-prod
 *   pnpm research:run -- --cell how_to_teach:multiplication-division:early_elem --wait --confirm-prod
 *
 * `--count` asks the demand queue for due cells. `--cell` forces an
 * explicit cell even when it is fresh, useful for focused validation;
 * prior-source and claim dedup still apply. Repeat --cell for a batch.
 */
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { assertConfirmedProdWrite } from "./prod-write-guard.mts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when env arrives from the shell or CI.
}

// Dynamic after env load on purpose: research-operations loads mapDb
// when --wait is used, and mapDb reads the database password at runtime.
const {
  closeResearchDatabase,
  triggerResearch,
  waitForResearchRuns,
} = await import("./research-operations.mts");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function argValues(flag: string): string[] {
  return process.argv.flatMap((argument, index) =>
    argument === flag && process.argv[index + 1]
      ? [process.argv[index + 1]]
      : [],
  );
}

function parseCell(value: string): {
  lens: string;
  topicKey: string;
  stage: string | null;
} {
  const [lens, topicKey, stage = "all", ...extra] = value.split(":");
  if (!lens || !topicKey || extra.length > 0) {
    throw new Error(
      `Invalid --cell "${value}". Expected lens:topicKey:stage (use all for no stage).`,
    );
  }
  return { lens, topicKey, stage: stage === "all" ? null : stage };
}

function usage(): void {
  console.log(
    [
      "Usage:",
      "  pnpm research:run -- --count 10 [--wait] [--base URL] --confirm-prod",
      "  pnpm research:run -- --cell lens:topicKey:stage [--cell ...] [--wait] --confirm-prod",
      "",
      "Examples:",
      "  --cell curriculum:dimensions-math:all",
      "  --cell how_to_teach:multiplication-division:early_elem",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    usage();
    return;
  }
  const countRaw = argValue("--count");
  const cellValues = argValues("--cell");
  if (countRaw && cellValues.length > 0) {
    throw new Error("Pass either --count or --cell, never both.");
  }
  const count = countRaw ? Number(countRaw) : null;
  if (
    count !== null &&
    (!Number.isInteger(count) || count < 1 || count > 20)
  ) {
    throw new Error("--count must be an integer from 1 to 20.");
  }

  const baseUrl =
    argValue("--base") ??
    process.env.HOMA_RESEARCH_BASE_URL ??
    "https://thankshoma.com";
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required.");

  assertConfirmedProdWrite({
    scriptName: "research-run",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const body =
    cellValues.length > 0
      ? { cells: cellValues.map(parseCell) }
      : { count: count ?? 1 };
  const response = await triggerResearch({
    baseUrl,
    secret,
    body,
    trigger: "manual",
  });
  console.log(JSON.stringify(response, null, 2));

  const runIds = response.started.map((run) => run.runId);
  if (!process.argv.includes("--wait") || runIds.length === 0) return;

  let previous = "";
  const runs = await waitForResearchRuns(runIds, {
    onPoll(current) {
      const status = current.map((run) => `${run.id.slice(0, 8)}=${run.status}`).join(" ");
      if (status !== previous) {
        console.log(status);
        previous = status;
      }
    },
  });
  console.log(
    JSON.stringify(
      runs.map((run) => ({
        id: run.id,
        cell: run.cellKey,
        status: run.status,
        summary: run.summary,
        error: run.error,
        rows: run.rows.map((row) => ({
          status: row.status,
          title: row.title,
          citations: row.citations.map((citation) => citation.url),
          flaggedReason: row.flaggedReason,
        })),
      })),
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await closeResearchDatabase();
}
