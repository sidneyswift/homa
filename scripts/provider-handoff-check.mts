import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  collectProviderRepositoryPaths,
  loadProviderHandoffInputs,
  reconcileProviderHandoffBindings,
  validateProviderHandoffs,
  PROVIDER_HANDOFF_HARNESS_VERSION,
} from "./provider-handoff-contract.mts";
import { loadEvidenceReceiptCatalog, loadTrackedPathChecksums } from "./evidence-receipt-loader.mts";

const inputs = loadProviderHandoffInputs();
const { manifest } = inputs;
let { handoffs } = inputs;
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const { checksums: sourceChecksums } = loadTrackedPathChecksums(root, collectProviderRepositoryPaths(handoffs));
if (process.argv.includes("--write")) {
  handoffs = reconcileProviderHandoffBindings(manifest, handoffs, sourceChecksums);
  const path = resolve(root, "docs/homa-design/evidence/provider-handoffs.json");
  writeFileSync(path, `${JSON.stringify(handoffs, null, 2)}\n`);
  console.log(`Wrote ${relative(root, path)} with exact source and provider-surface bindings.`);
}
const receiptCatalog = loadEvidenceReceiptCatalog(root, handoffs);
const issues = validateProviderHandoffs({ manifest, handoffs, sourceChecksums, receiptCatalog });
if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`[${issue.code}]${issue.recordId ? ` ${issue.recordId}` : ""} ${issue.message}`);
  }
  throw new Error(`Provider handoff gate failed with ${issues.length} finding(s).`);
}

console.log(
  `Provider handoff contract current: ${handoffs.records.length} #732 handoffs, ${PROVIDER_HANDOFF_HARNESS_VERSION}, all external read-backs remain explicitly evidence-gated.`,
);
