/**
 * Paid real-model ratchet for Family Library metadata judgment. The model
 * proposes, production verification checks every assertion, and this runner
 * measures the verified result against the representative corpus in #574.
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  FAMILY_ASSET_INGESTION_EVAL_FIXTURES,
  FAMILY_ASSET_INGESTION_RATCHET,
  scoreFamilyAssetIngestionEval,
  type FamilyAssetIngestionEvalObservation,
} from "../apps/web/lib/library/family-asset-ingestion-eval";
import { verifyFamilyAssetIngestion } from "../apps/web/lib/library/family-asset-ingestion";
import { proposeFamilyAssetIngestion } from "../apps/web/lib/library/family-asset-ingestion-model";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Scheduled CI supplies VERCEL_OIDC_TOKEN directly.
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const observations: FamilyAssetIngestionEvalObservation[] = [];
const failures: { fixtureId: string; message: string }[] = [];
let nextFixture = 0;

async function worker(): Promise<void> {
  while (nextFixture < FAMILY_ASSET_INGESTION_EVAL_FIXTURES.length) {
    const fixture = FAMILY_ASSET_INGESTION_EVAL_FIXTURES[nextFixture];
    nextFixture += 1;
    try {
      const proposal = await proposeFamilyAssetIngestion({
        familyId: null,
        originalName: fixture.originalName,
        mediaType: fixture.mediaType,
        extractedText: fixture.extractedText,
      });
      const verified = verifyFamilyAssetIngestion(proposal, fixture.extractedText);
      observations.push({ fixture, proposal, verified });
      const actual = verified.ok
        ? [
            `kind=${verified.resourceKind ?? "null"}`,
            `title=${JSON.stringify(verified.title)}`,
            `subjects=${verified.tags
              .filter((tag) => tag.kind === "subject")
              .map((tag) => tag.catalogId)
              .join(",") || "none"}`,
            `ages=${verified.tags
              .filter((tag) => tag.kind === "age_band")
              .map((tag) => tag.catalogId)
              .join(",") || "none"}`,
            `dropped=${verified.droppedFields.length + verified.droppedTags.length}`,
          ].join(" ")
        : "invalid proposal";
      console.log(`CASE  ${fixture.id}  ${actual}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown model failure";
      failures.push({ fixtureId: fixture.id, message });
      console.error(`FAIL  ${fixture.id}  ${message}`);
    }
  }
}

await Promise.all([worker(), worker()]);

const score = scoreFamilyAssetIngestionEval(observations);
console.log("\nFamily Library ingestion judgment");
for (const metric of [
  "resourceKindAccuracy",
  "titleAccuracy",
  "subjectAccuracy",
  "ageBandAccuracy",
  "sourceQuoteAccuracy",
] as const) {
  console.log(
    `${metric.padEnd(24)} ${percent(score[metric]).padStart(4)}  ` +
      `ratchet ${percent(FAMILY_ASSET_INGESTION_RATCHET[metric])}`,
  );
}
console.log(`fixtures${String(score.fixtureCount).padStart(20)} / ${FAMILY_ASSET_INGESTION_EVAL_FIXTURES.length}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} model call(s) failed.`);
}
process.exit(score.passed && failures.length === 0 ? 0 : 1);
