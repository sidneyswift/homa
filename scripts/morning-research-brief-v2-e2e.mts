/**
 * Secret-free production-shaped acceptance suite for morning research brief v2.
 *
 * It intentionally leaves the existing tasks:e2e live/dev-server contract
 * unchanged. The PostgreSQL lifecycle fixture starts and deletes its own local
 * database cluster, so this command never requires a remote project.
 */
import { spawn } from "node:child_process";

const testFiles = [
  "apps/web/lib/knowledge/citation-source.test.ts",
  "apps/web/lib/knowledge/select-brief.test.ts",
  "apps/web/lib/tasks/delivery-version.test.ts",
  "apps/web/lib/tasks/research-brief-format.test.ts",
  "apps/web/lib/tasks/research-brief-preparation.test.ts",
  "apps/web/lib/tasks/research-brief-delivery.test.ts",
  "apps/web/lib/tasks/research-brief-events.test.ts",
  "apps/web/lib/tasks/durable-task-completion.test.ts",
  "apps/web/lib/tasks/dispatch-transport.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-schema.test.ts",
  "apps/web/lib/tasks/scheduled-skip-postgres.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-preparation.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-delivery.test.ts",
  "apps/web/lib/tasks/email-delivery-postgres.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-recovery.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-feedback.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-report.test.ts",
  "apps/web/lib/conversation-continuity/reply-policy.test.ts",
  "apps/web/lib/admin/morning-brief-metrics.test.ts",
] as const;

const child = spawn("pnpm", ["exec", "tsx", "--test", ...testFiles], {
  env: process.env,
  stdio: "inherit",
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Morning research brief v2 E2E stopped by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
