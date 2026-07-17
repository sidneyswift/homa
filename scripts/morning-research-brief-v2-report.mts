/**
 * Read-only aggregate rollout report for morning research brief v2.
 *
 * Usage:
 *   pnpm morning-research-brief-v2:report -- --database-url "$DATABASE_URL" --project sandbox --since 2026-07-16T00:00:00Z [--until 2026-07-17T00:00:00Z]
 *
 * The target name and URL are required deliberately. This script never reads
 * credentials from environment files, and it prints only a database host and
 * database name before querying. Output has no identifiers or parent content.
 */
import postgres from "postgres";

import {
  assertMorningResearchBriefReportIsPiiFree,
  buildMorningResearchBriefRolloutReport,
  loadMorningResearchBriefRolloutReportRows,
  parseMorningResearchBriefReportWindow,
  runReadOnlyMorningResearchBriefReport,
} from "./morning-research-brief-v2-report-lib";

function requiredArgument(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? null : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required ${flag}.`);
  }
  return value;
}

function targetIdentity(databaseUrl: string, project: string): string {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, "") || "(default)";
  return `target project=${project}, database=${parsed.hostname}/${database}`;
}

const databaseUrl = requiredArgument("--database-url");
const project = requiredArgument("--project");
const window = parseMorningResearchBriefReportWindow(process.argv.slice(2));
console.log(targetIdentity(databaseUrl, project));
console.log(
  `window since=${window.since.toISOString()} until=${window.until?.toISOString() ?? "now"}`,
);
console.log("read-only aggregate report, no identifiers or message content are printed");

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

try {
  const rows = await runReadOnlyMorningResearchBriefReport(
    sql,
    async (transaction) =>
      await loadMorningResearchBriefRolloutReportRows(transaction, window),
  );
  const report = buildMorningResearchBriefRolloutReport(rows);
  assertMorningResearchBriefReportIsPiiFree(report);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
