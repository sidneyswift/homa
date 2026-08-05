import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_REMOVAL_HARNESS_VERSION,
  openLegacyRemovalRecords,
  reconcileLegacyRemovalLedger,
  validateLegacyRemovalLedger,
  type LegacyRemovalHistoryAnchorCatalog,
  type LegacyRemovalLedger,
  type LegacyRemovalRecord,
} from "../packages/design/src/legacy-removal.ts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";
import { loadEvidenceReceiptCatalog } from "./evidence-receipt-loader.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const LEDGER_PATH = resolve(ROOT, "docs/homa-design/evidence/legacy-removal.json");
const WRITE = process.argv.includes("--write");
const STRICT = process.argv.includes("--strict");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

type GitReader = (args: readonly string[]) => string | null;

function defaultGitReader(args: readonly string[]): string | null {
  try {
    return execFileSync("git", [...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function recordsFromLedgerBytes(bytes: string | null): LegacyRemovalRecord[] {
  if (bytes === null) return [];
  try {
    const value = JSON.parse(bytes) as { records?: unknown };
    return Array.isArray(value.records)
      ? value.records.filter((record): record is LegacyRemovalRecord => Boolean(record && typeof record === "object"))
      : [];
  } catch {
    return [];
  }
}

export function loadLegacyRemovalHistoryAnchors(
  currentLedgerBytes: string,
  git: GitReader = defaultGitReader,
): LegacyRemovalHistoryAnchorCatalog {
  const ledgerPath = relative(ROOT, LEDGER_PATH).replaceAll("\\", "/");
  const committedHeadBytes = git(["show", `HEAD:${ledgerPath}`]);
  const historyStart = committedHeadBytes === currentLedgerBytes ? "HEAD^" : "HEAD";
  const commits = (git(["rev-list", historyStart, "--", ledgerPath]) ?? "")
    .split("\n")
    .map((commit) => commit.trim())
    .filter(Boolean);
  const anchors = new Map<string, { sourceCommit: string; record: LegacyRemovalRecord }>();
  for (const commit of commits) {
    for (const record of recordsFromLedgerBytes(git(["show", `${commit}:${ledgerPath}`]))) {
      if (anchors.has(record.surfaceId)
        || record.sourceState === "absent"
        || !/^[0-9a-f]{64}$/.test(record.sourceHash ?? "")) continue;
      anchors.set(record.surfaceId, { sourceCommit: commit, record: structuredClone(record) });
    }
  }
  return anchors;
}

function reportQueue(ledger: LegacyRemovalLedger): void {
  const open = openLegacyRemovalRecords(ledger);
  const byOwner = new Map<string, number>();
  for (const record of open) byOwner.set(record.ownerIssue, (byOwner.get(record.ownerIssue) ?? 0) + 1);
  const ownerSummary = [...byOwner]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([owner, count]) => `${owner}=${count}`)
    .join(", ");
  if (open.length === 0) {
    console.log(`Legacy removal ledger closed: ${ledger.records.length} records, ${LEGACY_REMOVAL_HARNESS_VERSION}.`);
    return;
  }
  console.log(`Legacy removal queue: ${open.length} open of ${ledger.records.length} records${ownerSummary ? ` (${ownerSummary})` : ""}.`);
}

function main(): void {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Missing surface manifest: ${relative(ROOT, MANIFEST_PATH)}`);
  const manifest = readJson(MANIFEST_PATH) as BrandSurfaceManifest;
  const existing = existsSync(LEDGER_PATH) ? readJson(LEDGER_PATH) : null;
  const reconciled = reconcileLegacyRemovalLedger(manifest, existing);

  if (WRITE) {
    writeFileSync(LEDGER_PATH, serialize(reconciled));
    console.log(`Wrote ${relative(ROOT, LEDGER_PATH)} with ${reconciled.records.length} records.`);
    reportQueue(reconciled);
    return;
  }

  if (!existsSync(LEDGER_PATH)) throw new Error(`Missing legacy removal ledger. Run: pnpm build:legacy-removal`);
  const ledger = existing as LegacyRemovalLedger;
  const receiptCatalog = loadEvidenceReceiptCatalog(ROOT, ledger);
  const current = readFileSync(LEDGER_PATH, "utf8");
  const historyAnchors = loadLegacyRemovalHistoryAnchors(current);
  const issues = validateLegacyRemovalLedger(manifest, ledger, receiptCatalog, historyAnchors);
  if (current !== serialize(reconciled)) {
    issues.push({
      code: "generated-ledger-stale",
      message: "Generated source bindings are stale. Run pnpm build:legacy-removal to reset affected records to open.",
    });
  }
  if (issues.length > 0) {
    for (const issue of issues) console.error(`[${issue.code}]${issue.surfaceId ? ` ${issue.surfaceId}` : ""} ${issue.message}`);
    throw new Error(`Legacy removal ledger failed with ${issues.length} contract finding(s).`);
  }

  reportQueue(ledger);
  const open = openLegacyRemovalRecords(ledger);
  if (STRICT && open.length > 0) {
    throw new Error(`Legacy eradication certification failed: ${open.length} removal record(s) remain open.`);
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main();
