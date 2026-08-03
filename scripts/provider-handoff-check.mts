import { loadProviderHandoffInputs, validateProviderHandoffs, PROVIDER_HANDOFF_HARNESS_VERSION } from "./provider-handoff-contract.mts";

const { manifest, handoffs } = loadProviderHandoffInputs();
const issues = validateProviderHandoffs({ manifest, handoffs });
if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`[${issue.code}]${issue.recordId ? ` ${issue.recordId}` : ""} ${issue.message}`);
  }
  throw new Error(`Provider handoff gate failed with ${issues.length} finding(s).`);
}

console.log(
  `Provider handoff contract current: ${handoffs.records.length} #732 handoffs, ${PROVIDER_HANDOFF_HARNESS_VERSION}, all external read-backs remain explicitly evidence-gated.`,
);
