import assert from "node:assert/strict";
import test from "node:test";

import {
  artifactFamilyIdFromPathname,
  auditArtifactFamilyPrefixes,
  blobStoreIdFromReadWriteToken,
} from "./account-deletion-artifact-prefix-audit.mts";

const LIVE_FAMILY = "11111111-1111-4111-8111-111111111111";
const INHERITED_FAMILY = "22222222-2222-4222-8222-222222222222";
const TOMBSTONED_FAMILY = "33333333-3333-4333-8333-333333333333";
const UNRESOLVED_FAMILY = "44444444-4444-4444-8444-444444444444";
const OTHER_LIVE_FAMILY = "55555555-5555-4555-8555-555555555555";
const PUBLIC_STORE_ID = "publicstore";
const PRIVATE_STORE_ID = "privatestore";

function blob(
  access: "public" | "private",
  storeId: string,
  pathname: string,
): { pathname: string; url: string } {
  return {
    pathname,
    url: `https://${storeId}.${access}.blob.vercel-storage.com/${pathname}`,
  };
}

test("extracts only an exact UUID family root", () => {
  assert.equal(
    artifactFamilyIdFromPathname(
      `families/${LIVE_FAMILY}/materials/packet.pdf`,
    ),
    LIVE_FAMILY,
  );
  assert.equal(
    artifactFamilyIdFromPathname(`archive/families/${LIVE_FAMILY}/file.pdf`),
    null,
  );
  assert.equal(artifactFamilyIdFromPathname("families/not-a-uuid/file.pdf"), null);
  assert.equal(
    blobStoreIdFromReadWriteToken(
      ["vercel", "blob", "rw", "store123", "fixture"].join("_"),
    ),
    "store123",
  );
  assert.equal(blobStoreIdFromReadWriteToken("vercel_blob_client_bad"), null);
});

test("classifies live, inherited, and tombstoned prefixes across both stores", () => {
  const report = auditArtifactFamilyPrefixes({
    publicStore: {
      storeId: PUBLIC_STORE_ID,
      blobs: [
        blob("public", PUBLIC_STORE_ID, `families/${LIVE_FAMILY}/materials/packet.pdf`),
        blob("public", PUBLIC_STORE_ID, `families/${INHERITED_FAMILY}/chat/photo.jpg`),
        blob("public", PUBLIC_STORE_ID, `families/${TOMBSTONED_FAMILY}/videos/late.mp4`),
      ],
    },
    privateStore: {
      storeId: PRIVATE_STORE_ID,
      blobs: [
        blob("private", PRIVATE_STORE_ID, `families/${INHERITED_FAMILY}/lessons/lesson/segment.m4a`),
      ],
    },
    liveFamilyIds: [LIVE_FAMILY],
    aliases: [
      { artifactFamilyId: INHERITED_FAMILY, ownerFamilyId: LIVE_FAMILY },
    ],
    candidates: [{
      artifactFamilyId: INHERITED_FAMILY,
      ownerFamilyId: LIVE_FAMILY,
      evidenceKind: "lesson_audio",
      evidenceCount: 1,
    }],
    tombstoneFamilyIds: [TOMBSTONED_FAMILY],
  });
  assert.deepEqual(report, {
    publicPrefixCount: 3,
    privatePrefixCount: 1,
    totalPrefixCount: 3,
    livePrefixCount: 1,
    inheritedPrefixCount: 1,
    tombstonedPrefixCount: 1,
    unresolvedPrefixIds: [],
    unresolvedCandidateIds: [],
    invalidPublicPathCount: 0,
    invalidPrivatePathCount: 0,
    invalidPublicUrlCount: 0,
    invalidPrivateUrlCount: 0,
    storeIntegrityErrors: [],
    ledgerIntegrityErrors: [],
    candidateIntegrityErrors: [],
  });
});

test("fails evidence closed for unresolved paths and broken alias ownership", () => {
  const report = auditArtifactFamilyPrefixes({
    publicStore: {
      storeId: PUBLIC_STORE_ID,
      blobs: [
        blob("public", PUBLIC_STORE_ID, `families/${UNRESOLVED_FAMILY}/library/orphan.pdf`),
        blob("public", PUBLIC_STORE_ID, "families/not-a-uuid/video.mp4"),
      ],
    },
    privateStore: { storeId: PRIVATE_STORE_ID, blobs: [] },
    liveFamilyIds: [LIVE_FAMILY, INHERITED_FAMILY],
    aliases: [
      { artifactFamilyId: INHERITED_FAMILY, ownerFamilyId: UNRESOLVED_FAMILY },
    ],
    candidates: [],
    tombstoneFamilyIds: [],
  });
  assert.deepEqual(report.unresolvedPrefixIds, [UNRESOLVED_FAMILY]);
  assert.equal(report.invalidPublicPathCount, 1);
  assert.deepEqual(report.ledgerIntegrityErrors, [
    `Artifact prefix ${INHERITED_FAMILY} has no live owner.`,
    `Artifact prefix ${INHERITED_FAMILY} is both live and inherited.`,
  ]);
});

test("rejects duplicate stores and Blob URLs from the wrong host", () => {
  const pathname = `families/${LIVE_FAMILY}/materials/packet.pdf`;
  const report = auditArtifactFamilyPrefixes({
    publicStore: {
      storeId: PUBLIC_STORE_ID,
      blobs: [blob("public", "forgedstore", pathname)],
    },
    privateStore: { storeId: PUBLIC_STORE_ID, blobs: [] },
    liveFamilyIds: [LIVE_FAMILY],
    aliases: [],
    candidates: [],
    tombstoneFamilyIds: [],
  });
  assert.equal(report.invalidPublicUrlCount, 1);
  assert.equal(report.invalidPrivateUrlCount, 0);
  assert.deepEqual(report.storeIntegrityErrors, [
    "Public and private Blob credentials resolve to the same store.",
  ]);
});

test("rejects live, multiply-owned, conflicting, and tombstoned candidates", () => {
  const report = auditArtifactFamilyPrefixes({
    publicStore: { storeId: PUBLIC_STORE_ID, blobs: [] },
    privateStore: { storeId: PRIVATE_STORE_ID, blobs: [] },
    liveFamilyIds: [LIVE_FAMILY, OTHER_LIVE_FAMILY, INHERITED_FAMILY],
    aliases: [{
      artifactFamilyId: UNRESOLVED_FAMILY,
      ownerFamilyId: LIVE_FAMILY,
    }],
    candidates: [
      {
        artifactFamilyId: INHERITED_FAMILY,
        ownerFamilyId: LIVE_FAMILY,
        evidenceKind: "material_output",
        evidenceCount: 1,
      },
      {
        artifactFamilyId: UNRESOLVED_FAMILY,
        ownerFamilyId: LIVE_FAMILY,
        evidenceKind: "lesson_audio",
        evidenceCount: 1,
      },
      {
        artifactFamilyId: UNRESOLVED_FAMILY,
        ownerFamilyId: OTHER_LIVE_FAMILY,
        evidenceKind: "material_output",
        evidenceCount: 2,
      },
      {
        artifactFamilyId: TOMBSTONED_FAMILY,
        ownerFamilyId: LIVE_FAMILY,
        evidenceKind: "lesson_audio",
        evidenceCount: 1,
      },
    ],
    tombstoneFamilyIds: [TOMBSTONED_FAMILY],
  });
  assert.deepEqual(report.unresolvedCandidateIds, [
    INHERITED_FAMILY,
    TOMBSTONED_FAMILY,
    UNRESOLVED_FAMILY,
  ]);
  assert.deepEqual(report.candidateIntegrityErrors, [
    `Candidate prefix ${INHERITED_FAMILY} belongs to a live family.`,
    `Candidate prefix ${TOMBSTONED_FAMILY} is already tombstoned.`,
    `Candidate prefix ${UNRESOLVED_FAMILY} conflicts with its recorded owner.`,
    `Candidate prefix ${UNRESOLVED_FAMILY} has more than one proposed owner.`,
  ]);
});
