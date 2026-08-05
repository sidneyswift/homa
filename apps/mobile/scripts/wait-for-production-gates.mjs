#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_GATE_CHECKER_VERSION = "mobile-production-gates-v1";
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const TERMINAL_CHECK_FAILURES = new Set([
  "action_required",
  "cancelled",
  "failure",
  "neutral",
  "skipped",
  "stale",
  "startup_failure",
  "timed_out",
]);

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function timestamp(value) {
  const raw = nonEmpty(value);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveIdentifier(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  return typeof value === "string" && /^[1-9]\d*$/u.test(value);
}

function validHttpUrl(value) {
  const raw = nonEmpty(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validTimestamp(value) {
  return timestamp(value) > 0;
}

function latestByTime(values, fields) {
  return [...values].sort((left, right) => {
    const leftTime = Math.max(...fields.map((field) => timestamp(left[field])));
    const rightTime = Math.max(...fields.map((field) => timestamp(right[field])));
    return rightTime - leftTime || Number(right.id ?? 0) - Number(left.id ?? 0);
  })[0] ?? null;
}

function checkRunEvidence(run) {
  if (!run) return null;
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion ?? null,
    startedAt: run.started_at ?? null,
    completedAt: run.completed_at ?? null,
    detailsUrl: run.details_url ?? run.html_url ?? null,
  };
}

function vercelEvidence(status) {
  if (!status) return null;
  return {
    id: status.id,
    context: status.context,
    state: status.state,
    createdAt: status.created_at ?? null,
    updatedAt: status.updated_at ?? null,
    targetUrl: status.target_url ?? null,
  };
}

function completeBuildAndCheckEvidence(run) {
  return positiveIdentifier(run?.id)
    && run?.name === "build-and-check"
    && run?.status === "completed"
    && run?.conclusion === "success"
    && validTimestamp(run?.completed_at)
    && validHttpUrl(run?.details_url ?? run?.html_url);
}

function completeVercelEvidence(status) {
  return positiveIdentifier(status?.id)
    && status?.context === "Vercel"
    && status?.state === "success"
    && validTimestamp(status?.updated_at)
    && validHttpUrl(status?.target_url);
}

export function evaluateProductionGates({ sourceSha, checkRunsResponse, combinedStatusResponse }) {
  if (!SHA_PATTERN.test(sourceSha)) throw new Error("sourceSha must be a full lowercase Git SHA");
  const checksEnvelope = asRecord(checkRunsResponse);
  const statusEnvelope = asRecord(combinedStatusResponse);
  if (!checksEnvelope || !Array.isArray(checksEnvelope.check_runs)) {
    throw new Error("GitHub check-runs response is malformed");
  }
  if (!statusEnvelope || !Array.isArray(statusEnvelope.statuses)) {
    throw new Error("GitHub combined-status response is malformed");
  }
  if (nonEmpty(statusEnvelope.sha)?.toLowerCase() !== sourceSha) {
    throw new Error("GitHub combined-status response does not belong to the requested source SHA");
  }

  const exactChecks = checksEnvelope.check_runs
    .map(asRecord)
    .filter(Boolean)
    .filter((run) => run.name === "build-and-check" && nonEmpty(run.head_sha)?.toLowerCase() === sourceSha);
  const buildAndCheck = latestByTime(exactChecks, ["completed_at", "started_at"]);
  const vercelStatuses = statusEnvelope.statuses
    .map(asRecord)
    .filter(Boolean)
    .filter((status) => status.context === "Vercel");
  const vercel = latestByTime(vercelStatuses, ["updated_at", "created_at"]);

  let checkState = "pending";
  if (buildAndCheck?.status === "completed") {
    checkState = buildAndCheck.conclusion === "success" && completeBuildAndCheckEvidence(buildAndCheck)
      ? "success"
      : "failure";
  } else if (buildAndCheck && !["in_progress", "pending", "queued", "requested", "waiting"].includes(buildAndCheck.status)) {
    checkState = "failure";
  }
  if (buildAndCheck?.status === "completed" && TERMINAL_CHECK_FAILURES.has(buildAndCheck.conclusion)) {
    checkState = "failure";
  }

  const vercelState = vercel?.state === "success"
    ? completeVercelEvidence(vercel) ? "success" : "failure"
    : vercel?.state === "failure" || vercel?.state === "error"
      ? "failure"
      : "pending";
  const status = checkState === "failure" || vercelState === "failure"
    ? "failure"
    : checkState === "success" && vercelState === "success"
      ? "pass"
      : "pending";

  return {
    schemaVersion: 1,
    checkerVersion: PRODUCTION_GATE_CHECKER_VERSION,
    status,
    sourceSha,
    buildAndCheck: checkRunEvidence(buildAndCheck),
    vercel: vercelEvidence(vercel),
  };
}

export async function waitForProductionGates({
  sourceSha,
  fetchSnapshot,
  sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
  pollIntervalMs = 10_000,
  maxAttempts = 540,
  onPending = () => {},
}) {
  if (typeof fetchSnapshot !== "function") throw new Error("fetchSnapshot must be provided");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("maxAttempts must be a positive integer");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const snapshot = await fetchSnapshot();
    const report = evaluateProductionGates({ sourceSha, ...snapshot });
    if (report.status === "pass") return report;
    if (report.status === "failure") {
      const error = new Error("Production gates reached a terminal failure");
      error.report = report;
      throw error;
    }
    onPending({ attempt, maxAttempts, report });
    if (attempt < maxAttempts) await sleep(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for production gates after ${maxAttempts} attempts`);
}

async function githubJson({ repository, sourceSha, token, resource }) {
  const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sourceSha}/${resource}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${resource} request failed with ${response.status}`);
  return response.json();
}

export async function runProductionGateCli(environment = process.env) {
  const repository = nonEmpty(environment.GITHUB_REPOSITORY);
  const sourceSha = nonEmpty(environment.GITHUB_SHA)?.toLowerCase() ?? "";
  const token = nonEmpty(environment.GH_TOKEN) ?? nonEmpty(environment.GITHUB_TOKEN);
  if (!repository || !token || !SHA_PATTERN.test(sourceSha)) {
    throw new Error("GITHUB_REPOSITORY, GITHUB_SHA, and GH_TOKEN are required");
  }
  const outputDir = resolve(environment.HOMA_MOBILE_RELEASE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../artifacts/mobile-delivery"));
  const report = await waitForProductionGates({
    sourceSha,
    fetchSnapshot: async () => {
      const [checkRunsResponse, combinedStatusResponse] = await Promise.all([
        githubJson({ repository, sourceSha, token, resource: "check-runs?per_page=100&filter=latest" }),
        githubJson({ repository, sourceSha, token, resource: "status" }),
      ]);
      return { checkRunsResponse, combinedStatusResponse };
    },
    onPending: ({ attempt, maxAttempts, report: pending }) => {
      console.log(
        `Production gates pending (${attempt}/${maxAttempts}): build-and-check=${pending.buildAndCheck?.status ?? "missing"}, Vercel=${pending.vercel?.state ?? "missing"}`,
      );
    },
  });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "production-gates.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  const report = await runProductionGateCli();
  console.log(`Production gates passed for ${report.sourceSha}`);
  console.log(`build-and-check: ${report.buildAndCheck?.detailsUrl ?? "no URL"}`);
  console.log(`Vercel: ${report.vercel?.targetUrl ?? "no URL"}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (error?.report) console.error(JSON.stringify(error.report, null, 2));
    console.error(`Production gate check: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
