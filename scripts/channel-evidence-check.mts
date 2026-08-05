import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHANNEL_EVIDENCE_HARNESS_VERSION,
  channelFixturePaths,
  reconcileChannelEvidenceBindings,
  validateChannelEvidence,
  type ChannelEvidenceFile,
} from "./channel-evidence-contract.mts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";
import { loadEvidenceReceiptCatalog, loadTrackedPathChecksums } from "./evidence-receipt-loader.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const EVIDENCE_PATH = resolve(ROOT, "docs/homa-design/evidence/channel-evidence.json");
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const FIXTURE_ROOT = resolve(ROOT, "docs/homa-design/evidence/channel-inputs");
const WRITE = process.argv.includes("--write");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(): void {
  if (!existsSync(EVIDENCE_PATH)) throw new Error(`Missing channel evidence: ${EVIDENCE_PATH}`);
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Missing surface manifest: ${MANIFEST_PATH}`);
  const manifest = readJson(MANIFEST_PATH) as BrandSurfaceManifest;
  let evidence = readJson(EVIDENCE_PATH) as Partial<ChannelEvidenceFile>;
  let records = Array.isArray(evidence.records) ? evidence.records : [];
  const fixturePaths = Object.values(channelFixturePaths)
    .filter((path) => resolve(ROOT, path).startsWith(`${FIXTURE_ROOT}/`));
  const { checksums: fixtureChecksums } = loadTrackedPathChecksums(ROOT, fixturePaths);
  if (WRITE) {
    evidence = reconcileChannelEvidenceBindings(manifest, evidence, fixtureChecksums);
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Wrote ${relative(ROOT, EVIDENCE_PATH)} with profile-scoped source bindings.`);
    records = evidence.records;
  }
  const receiptCatalog = loadEvidenceReceiptCatalog(ROOT, evidence);
  const issues = validateChannelEvidence({ manifest, evidence, fixtureChecksums, receiptCatalog });
  if (issues.length > 0) {
    for (const issue of issues) console.error(`[${issue.code}]${issue.recordId ? ` ${issue.recordId}` : ""} ${issue.message}`);
    throw new Error(`Channel evidence gate failed with ${issues.length} finding(s).`);
  }
  console.log(`Channel evidence contract current: ${records.length} profiles, ${CHANNEL_EVIDENCE_HARNESS_VERSION}, each row bound only to its current manifest scope.`);
}

main();
