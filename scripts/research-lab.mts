/**
 * Condensed fleet-research lab.
 *
 * Runs several research rounds sequentially inside one hour-sized
 * session, waits for every round, then writes an audit report covering:
 * cell organization, statuses, source hosts/pages, exact-page overlap,
 * near-claim overlap, and gate flags. Sequential rounds matter for an
 * explicit repeated cell: round 2 receives round 1 in its PRIOR RESEARCH
 * dossier, proving that re-research advances rather than repeats.
 *
 * Usage:
 *   pnpm research:lab -- --count 5 --rounds 3 --confirm-prod
 *   pnpm research:lab -- --cell curriculum:dimensions-math:all --rounds 2 --confirm-prod
 *   pnpm research:lab -- --cell ... --rounds 2 --revert --confirm-prod
 */
import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  canonicalResearchUrl,
  findResearchDuplicates,
  type PriorResearchDossier,
} from "../apps/web/lib/knowledge/research-dedup";
import { assertConfirmedProdWrite } from "./prod-write-guard.mts";
import type {
  ResearchKnowledgeRow,
  ResearchRunSnapshot,
} from "./research-operations.mts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when env arrives from the shell or CI.
}

// Dynamic after env load because the operations module opens mapDb when
// polling or reverting.
const {
  closeResearchDatabase,
  revertResearchRuns,
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

function integerArg(
  flag: string,
  fallback: number,
  range: { min: number; max: number },
): number {
  const value = Number(argValue(flag) ?? fallback);
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    throw new Error(
      `${flag} must be an integer from ${range.min} to ${range.max}.`,
    );
  }
  return value;
}

function parseCell(value: string): {
  lens: string;
  topicKey: string;
  stage: string | null;
} {
  const [lens, topicKey, stage = "all", ...extra] = value.split(":");
  if (!lens || !topicKey || extra.length > 0) {
    throw new Error(
      `Invalid --cell "${value}". Expected lens:topicKey:stage.`,
    );
  }
  return { lens, topicKey, stage: stage === "all" ? null : stage };
}

function durationSeconds(run: ResearchRunSnapshot): number | null {
  if (!run.finishedAt) return null;
  return Math.round(
    (new Date(run.finishedAt).getTime() -
      new Date(run.startedAt).getTime()) /
      1000,
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return "(invalid URL)";
  }
}

function sourceOverlap(rows: ResearchKnowledgeRow[]): {
  repeatedPages: Array<{ url: string; occurrences: number }>;
  repeatedClaims: Array<{ topicKey: string; claim: string }>;
} {
  const pages = new Map<string, number>();
  const repeatedClaims: Array<{ topicKey: string; claim: string }> = [];
  const priorByTopic = new Map<string, PriorResearchDossier>();

  for (const row of rows) {
    const prior = priorByTopic.get(row.topicKey) ?? {
      topicKey: row.topicKey,
      rows: [],
    };
    const duplicates = findResearchDuplicates(row.citations, prior);
    repeatedClaims.push(
      ...duplicates.claims.map((claim) => ({
        topicKey: row.topicKey,
        claim,
      })),
    );
    for (const citation of row.citations) {
      const canonical = canonicalResearchUrl(citation.url);
      pages.set(canonical, (pages.get(canonical) ?? 0) + 1);
    }
    prior.rows.push({
      title: row.title,
      summary: row.summary,
      citations: row.citations,
    });
    priorByTopic.set(row.topicKey, prior);
  }

  return {
    repeatedPages: [...pages.entries()]
      .filter(([, occurrences]) => occurrences > 1)
      .map(([url, occurrences]) => ({ url, occurrences })),
    repeatedClaims,
  };
}

function markdownReport(input: {
  startedAt: string;
  finishedAt: string;
  rounds: ResearchRunSnapshot[][];
  reverted: { flagged: number; restored: number } | null;
}): string {
  const runs = input.rounds.flat();
  const rows = runs.flatMap((run) => run.rows);
  const overlap = sourceOverlap(rows);
  const hostCounts = new Map<string, number>();
  for (const row of rows) {
    for (const citation of row.citations) {
      const host = hostOf(citation.url);
      hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
    }
  }
  const lines = [
    "# Condensed research lab report",
    "",
    `Started: ${input.startedAt}`,
    `Finished: ${input.finishedAt}`,
    `Rounds: ${input.rounds.length}`,
    `Runs: ${runs.length} (${runs.filter((run) => run.status === "done").length} done, ${runs.filter((run) => run.status === "failed").length} failed)`,
    `Knowledge rows: ${rows.length}`,
    "",
    "## Runs by round",
  ];
  input.rounds.forEach((round, index) => {
    lines.push("", `### Round ${index + 1}`);
    for (const run of round) {
      lines.push(
        `- ${run.cellKey ?? run.title}: ${run.status} · ${durationSeconds(run) ?? "?"}s · ${run.rows.length} row(s)${run.error ? ` · error: ${run.error}` : ""}`,
      );
      for (const row of run.rows) {
        lines.push(
          `  - [${row.status}] ${row.lens ?? "legacy"}/${row.topicKey}/${row.stage ?? "all"}: ${row.title}`,
        );
        if (row.flaggedReason) {
          lines.push(`    - Gate: ${row.flaggedReason}`);
        }
        for (const citation of row.citations) {
          lines.push(
            `    - ${canonicalResearchUrl(citation.url)} · ${citation.claim}`,
          );
        }
      }
    }
  });

  lines.push("", "## Source diversity");
  if (hostCounts.size === 0) {
    lines.push("- No citations were saved.");
  } else {
    for (const [host, count] of [...hostCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    )) {
      lines.push(`- ${host}: ${count} citation(s)`);
    }
  }

  lines.push("", "## Duplicate-work checks");
  if (overlap.repeatedPages.length === 0) {
    lines.push("- PASS: no canonical article URL repeated across lab outputs.");
  } else {
    lines.push("- FAIL: repeated canonical pages:");
    for (const page of overlap.repeatedPages) {
      lines.push(`  - ${page.url} (${page.occurrences} uses)`);
    }
  }
  if (overlap.repeatedClaims.length === 0) {
    lines.push("- PASS: no near-repeat claims across same-topic lab outputs.");
  } else {
    lines.push("- FAIL: near-repeat claims:");
    for (const claim of overlap.repeatedClaims) {
      lines.push(`  - ${claim.topicKey}: ${claim.claim}`);
    }
  }

  lines.push("", "## Gate outcomes");
  const flagged = rows.filter((row) => row.flaggedReason);
  if (flagged.length === 0) {
    lines.push("- No rows were flagged.");
  } else {
    for (const row of flagged) {
      lines.push(`- ${row.topicKey}: ${row.flaggedReason}`);
    }
  }
  if (input.reverted) {
    lines.push(
      "",
      "## Cleanup",
      `Flagged ${input.reverted.flagged} active lab row(s); restored ${input.reverted.restored} predecessor(s). Run rows remain as the audit trail.`,
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log(
      [
        "Usage:",
        "  pnpm research:lab -- --count 5 --rounds 3 [--revert] --confirm-prod",
        "  pnpm research:lab -- --cell lens:topicKey:stage --rounds 2 [--revert] --confirm-prod",
        "",
        "Rounds are sequential; explicit cells repeat each round so round 2",
        "must advance beyond round 1's sources and claims.",
      ].join("\n"),
    );
    return;
  }
  const rounds = integerArg("--rounds", 2, { min: 1, max: 12 });
  const count = integerArg("--count", 3, { min: 1, max: 20 });
  const timeoutMinutes = integerArg("--timeout-minutes", 20, {
    min: 1,
    max: 60,
  });
  const cellValues = argValues("--cell");
  const explicitCells = cellValues.map(parseCell);
  const baseUrl =
    argValue("--base") ??
    process.env.HOMA_RESEARCH_BASE_URL ??
    "https://thankshoma.com";
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required.");

  assertConfirmedProdWrite({
    scriptName: "research-lab",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const startedAt = new Date().toISOString();
  const completedRounds: ResearchRunSnapshot[][] = [];
  const allRunIds: string[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    console.log(`round ${round}/${rounds}: starting`);
    const response = await triggerResearch({
      baseUrl,
      secret,
      body:
        explicitCells.length > 0
          ? { cells: explicitCells }
          : { count },
      trigger: "lab",
    });
    const runIds = response.started.map((run) => run.runId);
    allRunIds.push(...runIds);
    console.log(
      `round ${round}: ${runIds.length} started, ${response.skipped.length} already running, ${response.failed.length} startup failure(s)`,
    );
    if (runIds.length === 0) {
      completedRounds.push([]);
      continue;
    }
    let previous = "";
    const runs = await waitForResearchRuns(runIds, {
      timeoutMs: timeoutMinutes * 60_000,
      onPoll(current) {
        const status = current
          .map((run) => `${run.id.slice(0, 8)}=${run.status}`)
          .join(" ");
        if (status !== previous) {
          console.log(`round ${round}: ${status}`);
          previous = status;
        }
      },
    });
    completedRounds.push(runs);
  }

  const revert = process.argv.includes("--revert");
  const reverted = revert
    ? await revertResearchRuns(
        allRunIds,
        `reverted by condensed research lab ${startedAt}`,
      )
    : null;
  const finishedAt = new Date().toISOString();
  const report = markdownReport({
    startedAt,
    finishedAt,
    rounds: completedRounds,
    reverted,
  });
  const outputDirectory = path.join(repoRoot, ".tmp-research-lab");
  await mkdir(outputDirectory, { recursive: true });
  const stamp = startedAt.replace(/[:.]/gu, "-");
  const markdownPath = path.join(outputDirectory, `${stamp}.md`);
  const jsonPath = path.join(outputDirectory, `${stamp}.json`);
  await writeFile(markdownPath, report, "utf8");
  await writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        startedAt,
        finishedAt,
        rounds: completedRounds,
        reverted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(report);
  console.log(`Saved ${markdownPath}`);
  console.log(`Saved ${jsonPath}`);
}

try {
  await main();
} finally {
  await closeResearchDatabase();
}
