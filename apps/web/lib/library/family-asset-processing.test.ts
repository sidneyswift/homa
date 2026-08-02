import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  familyAssetFieldsFromVerified,
  familyAssetProcessingCapability,
  familyAssetProcessingFailureOutcome,
  processFamilyAssetWithDependencies,
  type ClaimedFamilyAsset,
  type FamilyAssetProcessingDependencies,
} from "./family-asset-processing";
import { familyAssetProcessingRetryAvailable } from "./family-assets";

const ASSET: ClaimedFamilyAsset = {
  id: "11111111-1111-4111-8111-111111111111",
  familyId: "22222222-2222-4222-8222-222222222222",
  title: "fractions-week-2",
  originalName: "fractions-week-2.pdf",
  url: "https://assets.public.blob.vercel-storage.com/families/22222222-2222-4222-8222-222222222222/library/fractions-week-2.pdf",
  mediaType: "application/pdf",
  resourceKind: null,
  language: null,
};

function dependencies(
  overrides: Partial<FamilyAssetProcessingDependencies> = {},
): FamilyAssetProcessingDependencies {
  return {
    claim: async () => ASSET,
    extract: async () => ({
      ok: true,
      text: "Fractions Practice\nWorksheet\nAdd fractions with like denominators.",
    }),
    propose: async () => ({
      title: {
        value: "Fractions Practice",
        quote: "Fractions Practice",
        sourceLocator: "page 1",
      },
      resourceKind: {
        value: "worksheet",
        quote: "Worksheet",
        sourceLocator: "page 1",
      },
      language: "en",
      tags: [
        {
          kind: "subject",
          value: "Math",
          catalogId: "math",
          quote: "Add fractions with like denominators.",
          sourceLocator: "page 1",
        },
      ],
    }),
    complete: async () => undefined,
    fail: async () => undefined,
    ...overrides,
  };
}

describe("Family Library runtime processing", () => {
  it("supports only extraction lanes that actually exist", () => {
    assert.equal(familyAssetProcessingCapability("application/pdf"), "pdf");
    assert.equal(familyAssetProcessingCapability("text/plain; charset=utf-8"), "text");
    assert.equal(
      familyAssetProcessingCapability(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      "word",
    );
    assert.equal(familyAssetProcessingCapability("image/png"), "image");
    assert.equal(familyAssetProcessingCapability("application/epub+zip"), null);
  });

  it("completes only a source-verified model proposal", async () => {
    let completedTitle: string | null = null;
    const result = await processFamilyAssetWithDependencies(
      { familyId: ASSET.familyId, assetId: ASSET.id },
      dependencies({
        complete: async ({ verified }) => {
          completedTitle = verified.title;
        },
      }),
    );

    assert.deepEqual(result, { ok: true, assetId: ASSET.id });
    assert.equal(completedTitle, "Fractions Practice");
  });

  it("records a permanent extraction outcome without calling the model", async () => {
    let proposed = false;
    let failedCode: string | null = null;
    const result = await processFamilyAssetWithDependencies(
      { familyId: ASSET.familyId, assetId: ASSET.id },
      dependencies({
        extract: async () => ({ ok: false, reason: "encrypted" }),
        propose: async () => {
          proposed = true;
          throw new Error("must not run");
        },
        fail: async ({ outcome }) => {
          failedCode = outcome.errorCode;
        },
      }),
    );

    assert.deepEqual(result, { ok: false, reason: "encrypted" });
    assert.equal(proposed, false);
    assert.equal(failedCode, "content_encrypted");
  });

  it("turns a provider failure into a retryable processing result", async () => {
    let failedCode: string | null = null;
    const result = await processFamilyAssetWithDependencies(
      { familyId: ASSET.familyId, assetId: ASSET.id },
      dependencies({
        propose: async () => {
          throw new Error("gateway unavailable");
        },
        fail: async ({ outcome }) => {
          failedCode = outcome.errorCode;
        },
      }),
    );

    assert.deepEqual(result, { ok: false, reason: "transient" });
    assert.equal(failedCode, "processing_failed");
  });

  it("offers retry only when repeating the same work can change the result", () => {
    assert.equal(
      familyAssetProcessingRetryAvailable({
        status: "failed",
        processingErrorCode: "processing_failed",
        updatedAt: "2026-08-01T12:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      familyAssetProcessingRetryAvailable({
        status: "needs_attention",
        processingErrorCode: "content_format_unsupported",
        updatedAt: "2026-08-01T12:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      familyAssetProcessingRetryAvailable(
        {
          status: "processing",
          processingErrorCode: null,
          updatedAt: "2026-08-01T11:50:00.000Z",
        },
        new Date("2026-08-01T12:00:00.000Z"),
      ),
      true,
    );
  });

  it("fills blanks without overwriting parent-authored metadata", () => {
    const verified = {
      ok: true as const,
      title: "Model title",
      resourceKind: "worksheet" as const,
      language: "en",
      fieldEvidence: { title: null, resourceKind: null },
      tags: [],
      droppedFields: [],
      droppedTags: [],
    };
    assert.deepEqual(
      familyAssetFieldsFromVerified(
        {
          title: "Parent title",
          defaultTitle: "fractions-week-2",
          resourceKind: "curriculum",
          language: "es",
        },
        verified,
      ),
      { title: "Parent title", resourceKind: "curriculum", language: "es" },
    );
    assert.deepEqual(
      familyAssetFieldsFromVerified(
        {
          title: "fractions-week-2",
          defaultTitle: "fractions-week-2",
          resourceKind: null,
          language: null,
        },
        verified,
      ),
      { title: "Model title", resourceKind: "worksheet", language: "en" },
    );
  });

  it("keeps exact non-retryable failure copy attached to the saved original", () => {
    assert.equal(
      familyAssetProcessingFailureOutcome("too_large").errorCode,
      "content_too_large_to_process",
    );
    assert.equal(
      familyAssetProcessingFailureOutcome("unsupported").preserveOriginal,
      true,
    );
  });
});
