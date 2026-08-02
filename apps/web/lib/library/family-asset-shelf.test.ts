import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FamilyAssetView } from "./family-assets";
import {
  FAMILY_ASSET_WHOLE_FAMILY_CHILD,
  FAMILY_ASSET_DELETE_CONSEQUENCE,
  familyAssetFilterOptions,
  familyLibraryAccess,
  familyAssetSourceLabel,
  familyAssetStatusCopy,
  familyAssetUpdateSchema,
  filterFamilyAssets,
  stableFamilyAssetDate,
  type FamilyAssetFilter,
} from "./family-asset-shelf";

const ASSETS: FamilyAssetView[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Fractions on Friday",
    originalName: "fractions-week-2.pdf",
    url: "https://assets.public.blob.vercel-storage.com/fractions.pdf",
    downloadUrl: "https://assets.public.blob.vercel-storage.com/fractions.pdf?download=1",
    mediaType: "application/pdf",
    byteSize: 2048,
    fileKind: "document",
    resourceKind: "worksheet",
    authors: [],
    publisher: null,
    language: "en",
    status: "ready",
    processingErrorCode: null,
    processingNote: null,
    sourceUploadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sourceAttachmentId: null,
    parentAssetId: null,
    children: [
      { id: "aaaaaaaa-1111-4111-8111-111111111111", name: "Mia" },
    ],
    subjects: [{ id: "math", label: "Math", source: "parent" }],
    processedAt: "2026-08-01T12:01:00.000Z",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:01:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Backyard bird guide",
    originalName: "bird-guide.epub",
    url: "https://assets.public.blob.vercel-storage.com/birds.epub",
    downloadUrl: "https://assets.public.blob.vercel-storage.com/birds.epub?download=1",
    mediaType: "application/epub+zip",
    byteSize: 4096,
    fileKind: "archive",
    resourceKind: "book",
    authors: ["A. Reader"],
    publisher: "Field House",
    language: "en",
    status: "needs_attention",
    processingErrorCode: "content_format_unsupported",
    processingNote: "Your original is still in your Library.",
    sourceUploadId: null,
    sourceAttachmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    parentAssetId: null,
    children: [],
    subjects: [{ id: "science", label: "Science", source: "model" }],
    processedAt: null,
    createdAt: "2026-08-01T13:00:00.000Z",
    updatedAt: "2026-08-01T13:01:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "History spine",
    originalName: "history-spine.pdf",
    url: "https://assets.public.blob.vercel-storage.com/history.pdf",
    downloadUrl: "https://assets.public.blob.vercel-storage.com/history.pdf?download=1",
    mediaType: "application/pdf",
    byteSize: 8192,
    fileKind: "document",
    resourceKind: "curriculum",
    authors: [],
    publisher: null,
    language: null,
    status: "failed",
    processingErrorCode: "content_corrupt",
    processingNote: "Your original is still in your Library.",
    sourceUploadId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceAttachmentId: null,
    parentAssetId: null,
    children: [
      { id: "bbbbbbbb-2222-4222-8222-222222222222", name: "Noah" },
    ],
    subjects: [{ id: "social_studies", label: "Social studies", source: "model" }],
    processedAt: null,
    createdAt: "2026-08-01T14:00:00.000Z",
    updatedAt: "2026-08-01T14:01:00.000Z",
  },
];

const EMPTY_FILTER: FamilyAssetFilter = {
  query: "",
  resourceKind: null,
  childId: null,
  subjectId: null,
  status: null,
};

describe("Family Library shelf contract", () => {
  it("combines remembered words with kind, child, subject, and status", () => {
    assert.deepEqual(
      filterFamilyAssets(ASSETS, {
        query: "fractions mia",
        resourceKind: "worksheet",
        childId: "aaaaaaaa-1111-4111-8111-111111111111",
        subjectId: "math",
        status: "ready",
      }).map((asset) => asset.id),
      ["11111111-1111-4111-8111-111111111111"],
    );

    assert.deepEqual(
      filterFamilyAssets(ASSETS, {
        ...EMPTY_FILTER,
        childId: FAMILY_ASSET_WHOLE_FAMILY_CHILD,
      }).map((asset) => asset.id),
      ["22222222-2222-4222-8222-222222222222"],
    );
  });

  it("derives stable filter options only from metadata on the shelf", () => {
    assert.deepEqual(familyAssetFilterOptions(ASSETS), {
      resourceKinds: ["worksheet", "book", "curriculum"],
      children: [
        { id: "aaaaaaaa-1111-4111-8111-111111111111", name: "Mia" },
        { id: "bbbbbbbb-2222-4222-8222-222222222222", name: "Noah" },
      ],
      subjects: [
        { id: "math", label: "Math" },
        { id: "science", label: "Science" },
        { id: "social_studies", label: "Social studies" },
      ],
      statuses: ["ready", "needs_attention", "failed"],
    });
  });

  it("names source and processing state without claiming private storage", () => {
    assert.equal(familyAssetSourceLabel(ASSETS[0]), "Uploaded from your device");
    assert.equal(familyAssetSourceLabel(ASSETS[1]), "Saved from chat");
    assert.deepEqual(familyAssetStatusCopy(ASSETS[0]), {
      label: "Ready",
      detail: "Your original is saved and ready to download.",
      tone: "ready",
    });
    assert.deepEqual(familyAssetStatusCopy(ASSETS[2]), {
      label: "Could not organize",
      detail: "Your original is still in your Library.",
      tone: "failed",
    });
    assert.deepEqual(
      familyAssetStatusCopy({
        status: "needs_attention",
        processingNote:
          "Your original is saved and ready to download. This file is too large for Homa to organize its Library details automatically. Use Edit details to add them yourself.",
      }),
      {
        label: "Needs attention",
        detail:
          "Your original is saved and ready to download. This file is too large for Homa to organize its Library details automatically. Add them below instead.",
        tone: "attention",
      },
    );
  });

  it("accepts only closed, deduplicated parent edits", () => {
    const valid = familyAssetUpdateSchema.safeParse({
      id: ASSETS[0].id,
      title: "Friday fractions",
      resourceKind: "worksheet",
      childIds: ["aaaaaaaa-1111-4111-8111-111111111111"],
      subjectIds: ["math"],
    });
    assert.equal(valid.success, true);

    assert.equal(
      familyAssetUpdateSchema.safeParse({
        id: ASSETS[0].id,
        title: "Friday fractions",
        resourceKind: "worksheet",
        childIds: [
          "aaaaaaaa-1111-4111-8111-111111111111",
          "aaaaaaaa-1111-4111-8111-111111111111",
        ],
        subjectIds: ["math"],
      }).success,
      false,
    );
    assert.equal(
      familyAssetUpdateSchema.safeParse({
        id: ASSETS[0].id,
        title: "Friday fractions",
        resourceKind: "worksheet",
        childIds: [],
        subjectIds: ["invented_subject"],
      }).success,
      false,
    );
  });

  it("states deletion consequences without overstating storage or deleting outputs", () => {
    assert.equal(
      FAMILY_ASSET_DELETE_CONSEQUENCE,
      "Homa will delete the saved original and its Library details: title, resource type, author, publisher, children, and subjects. The file on your device stays. Anything already in Binder stays there.",
    );
    assert.doesNotMatch(FAMILY_ASSET_DELETE_CONSEQUENCE, /private/iu);
    assert.equal(stableFamilyAssetDate("2026-08-01T23:59:59.000-07:00"), "Aug 2, 2026");
  });

  it("opens only existing Library records through the account wall", () => {
    assert.deepEqual(
      familyLibraryAccess({ walled: false, hasExistingRecords: false }),
      { canUpload: true, redirectToTrial: false },
    );
    assert.deepEqual(
      familyLibraryAccess({ walled: true, hasExistingRecords: true }),
      { canUpload: false, redirectToTrial: false },
    );
    assert.deepEqual(
      familyLibraryAccess({ walled: true, hasExistingRecords: false }),
      { canUpload: false, redirectToTrial: true },
    );
  });
});
