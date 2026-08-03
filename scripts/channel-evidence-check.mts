import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHANNEL_EVIDENCE_HARNESS_VERSION,
  validateChannelEvidence,
  type ChannelEvidenceFile,
} from "./channel-evidence-contract.mts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const EVIDENCE_PATH = resolve(ROOT, "docs/homa-design/evidence/channel-evidence.json");
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const FIXTURE_ROOT = resolve(ROOT, "docs/homa-design/evidence/channel-inputs");

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(): void {
  if (!existsSync(EVIDENCE_PATH)) throw new Error(`Missing channel evidence: ${EVIDENCE_PATH}`);
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Missing surface manifest: ${MANIFEST_PATH}`);
  const manifest = readJson(MANIFEST_PATH) as BrandSurfaceManifest;
  const evidence = readJson(EVIDENCE_PATH) as Partial<ChannelEvidenceFile>;
  const fixtureChecksums = new Map<string, string>();
  const records = Array.isArray(evidence.records) ? evidence.records : [];
  for (const record of records) {
    if (!record || typeof record !== "object" || typeof record.fixturePath !== "string") continue;
    const fixturePath = resolve(ROOT, record.fixturePath);
    if (!fixturePath.startsWith(`${FIXTURE_ROOT}/`) || !existsSync(fixturePath)) continue;
    fixtureChecksums.set(record.fixturePath, sha256(readFileSync(fixturePath)));
  }
  const issues = validateChannelEvidence({ manifest, evidence, fixtureChecksums });
  if (issues.length > 0) {
    for (const issue of issues) console.error(`[${issue.code}]${issue.recordId ? ` ${issue.recordId}` : ""} ${issue.message}`);
    throw new Error(`Channel evidence gate failed with ${issues.length} finding(s).`);
  }
  console.log(`Channel evidence contract current: ${records.length} profiles, ${CHANNEL_EVIDENCE_HARNESS_VERSION}, all rows fingerprinted to ${manifest.ownedInputFingerprint}.`);
}

main();
