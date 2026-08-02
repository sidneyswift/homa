import assert from "node:assert/strict";
import test from "node:test";

import {
  FamilyAssetTrainingPreparationError,
  buildFamilyAssetTrainingDatasetArtifacts,
  prepareFamilyAssetTrainingSource,
  type FamilyAssetTrainingPreparationDependencies,
  type FamilyAssetTrainingSourceContext,
} from "./family-asset-training";

const source: FamilyAssetTrainingSourceContext = {
  id: "11111111-1111-4111-8111-111111111111",
  familyId: "22222222-2222-4222-8222-222222222222",
  title: "A family title that does not belong in the export",
  originalName: "private-file-name.pdf",
  url: "https://example.public.blob.vercel-storage.com/families/22222222-2222-4222-8222-222222222222/library/private-file-name.pdf",
  mediaType: "application/pdf",
  resourceKind: "worksheet",
  language: "en",
  byteSize: 1200,
  status: "ready",
  contentSha256: "a".repeat(64),
  deletedAt: null,
  children: [{ name: "Maya Walker", birthDate: "2019-04-07" }],
};

function dependencies(
  document: Awaited<
    ReturnType<FamilyAssetTrainingPreparationDependencies["extract"]>
  >,
): FamilyAssetTrainingPreparationDependencies {
  return {
    load: async () => source,
    extract: async () => document,
  };
}

test("training preparation produces a minimized, source-grounded record", async () => {
  const prepared = await prepareFamilyAssetTrainingSource(
    { assetId: source.id },
    dependencies({
      ok: true,
      segmentKind: "page",
      segments: [
        { ordinal: 1, locator: "Page 1", text: "  Plant cells have walls.  " },
        { ordinal: 2, locator: "Page 2", text: "Label the nucleus." },
      ],
      totalSegments: 2,
      truncated: false,
    }),
  );
  assert.equal(prepared.decision, "eligible");
  assert.ok(prepared.record);
  assert.match(prepared.extractedContentSha256 ?? "", /^[0-9a-f]{64}$/u);

  const serialized = JSON.stringify(prepared.record);
  assert.doesNotMatch(serialized, new RegExp(source.id, "u"));
  assert.doesNotMatch(serialized, /22222222-2222-4222-8222-222222222222/u);
  assert.doesNotMatch(serialized, /Maya Walker/iu);
  assert.doesNotMatch(serialized, /private-file-name/iu);
  assert.doesNotMatch(serialized, /family title/iu);
  assert.doesNotMatch(serialized, /vercel-storage/u);
  assert.match(serialized, /Plant cells have walls/u);
  assert.match(serialized, /Page 2/u);
});

test("training preparation records privacy exclusions without exporting text", async () => {
  const prepared = await prepareFamilyAssetTrainingSource(
    { assetId: source.id },
    dependencies({
      ok: true,
      segmentKind: "page",
      segments: [
        {
          ordinal: 1,
          locator: "Page 1",
          text: "Maya Walker's Individualized Education Program",
        },
      ],
      totalSegments: 1,
      truncated: false,
    }),
  );
  assert.equal(prepared.decision, "excluded");
  assert.deepEqual(prepared.exclusionReasons, [
    "child_identifier_detected",
    "sensitive_record_detected",
  ]);
  assert.equal(prepared.record, null);
  assert.equal(prepared.recordSha256, null);
});

test("training preparation excludes truncation and model-captioned images", async () => {
  const truncated = await prepareFamilyAssetTrainingSource(
    { assetId: source.id },
    dependencies({
      ok: true,
      segmentKind: "page",
      segments: [{ ordinal: 1, locator: "Page 1", text: "Partial text" }],
      totalSegments: 300,
      truncated: true,
    }),
  );
  assert.deepEqual(truncated.exclusionReasons, ["truncated_source"]);

  const imageSource = { ...source, mediaType: "image/jpeg" };
  let extractCalled = false;
  const image = await prepareFamilyAssetTrainingSource(
    { assetId: imageSource.id },
    {
      load: async () => imageSource,
      extract: async () => {
        extractCalled = true;
        return {
          ok: true,
          segmentKind: "image",
          segments: [{ ordinal: 1, locator: "Image 1", text: "caption" }],
          totalSegments: 1,
          truncated: false,
        };
      },
    },
  );
  assert.deepEqual(image.exclusionReasons, ["unsupported_source"]);
  assert.equal(extractCalled, false);
});

test("transient extraction aborts instead of becoming a permanent exclusion", async () => {
  await assert.rejects(
    prepareFamilyAssetTrainingSource(
      { assetId: source.id },
      dependencies({ ok: false, reason: "transient" }),
    ),
    (error: unknown) =>
      error instanceof FamilyAssetTrainingPreparationError &&
      error.code === "transient",
  );
});

test("dataset bytes are deterministic and bind excluded decisions", async () => {
  const eligible = await prepareFamilyAssetTrainingSource(
    { assetId: source.id },
    dependencies({
      ok: true,
      segmentKind: "section",
      segments: [{ ordinal: 1, locator: "Section 1", text: "Safe text" }],
      totalSegments: 1,
      truncated: false,
    }),
  );
  const excludedSource = {
    ...source,
    id: "33333333-3333-4333-8333-333333333333",
    title: "Other source",
    originalName: "other.txt",
    mediaType: "text/plain",
  };
  const excluded = await prepareFamilyAssetTrainingSource(
    { assetId: excludedSource.id, operatorExcluded: true },
    { load: async () => excludedSource, extract: async () => assert.fail() },
  );

  const first = buildFamilyAssetTrainingDatasetArtifacts({
    datasetVersion: "family-library-v1",
    sources: [eligible, excluded],
  });
  const second = buildFamilyAssetTrainingDatasetArtifacts({
    datasetVersion: "family-library-v1",
    sources: [excluded, eligible],
  });
  assert.equal(first.jsonl, second.jsonl);
  assert.equal(first.manifestJson, second.manifestJson);
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.manifest.recordCount, 1);
  assert.equal(first.manifest.sourceDecisionCount, 2);
  assert.deepEqual(first.manifest.excludedByReason, { operator_excluded: 1 });

  const withoutExclusion = buildFamilyAssetTrainingDatasetArtifacts({
    datasetVersion: "family-library-v1",
    sources: [eligible],
  });
  assert.notEqual(first.manifest.decisionSha256, withoutExclusion.manifest.decisionSha256);
});
