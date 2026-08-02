import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseFamilyLibraryBackfillArgs,
  planFamilyLibraryBackfill,
  type FamilyLibraryBackfillCandidate,
} from "./backfill-family-library-chat-attachments.mts";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_FAMILY_ID = "22222222-2222-4222-8222-222222222222";

function candidate(
  id: string,
  url: string,
): FamilyLibraryBackfillCandidate {
  return {
    id,
    familyId: FAMILY_ID,
    memberUserId: null,
    url,
  };
}

describe("Family Library chat attachment backfill", () => {
  it("defaults to a dry run and requires explicit write intent", () => {
    assert.deepEqual(parseFamilyLibraryBackfillArgs([]), {
      write: false,
      confirmProd: false,
      limit: null,
      attachmentId: null,
      help: false,
    });
    assert.equal(
      parseFamilyLibraryBackfillArgs(["--write", "--confirm-prod"]).write,
      true,
    );
  });

  it("validates bounded filters before touching the database", () => {
    assert.throws(
      () => parseFamilyLibraryBackfillArgs(["--limit", "0"]),
      /positive integer/u,
    );
    assert.throws(
      () => parseFamilyLibraryBackfillArgs(["--attachment-id", "not-an-id"]),
      /must be a UUID/u,
    );
    assert.throws(
      () => parseFamilyLibraryBackfillArgs(["--unknown"]),
      /Unknown argument/u,
    );
    assert.throws(
      () => parseFamilyLibraryBackfillArgs(["--write", "--dry-run"]),
      /either --dry-run or --write/u,
    );
    assert.throws(
      () => parseFamilyLibraryBackfillArgs(["--dry-run", "--write"]),
      /either --dry-run or --write/u,
    );
  });

  it("selects only exact same-family chat Blob sources", () => {
    const firstId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const secondId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const candidates = [
      candidate(
        firstId,
        `https://assets.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/one.pdf`,
      ),
      candidate(
        secondId,
        `https://assets.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/two.pdf`,
      ),
      candidate(
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        `https://assets.public.blob.vercel-storage.com/families/${OTHER_FAMILY_ID}/chat/foreign.pdf`,
      ),
      candidate(
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "https://example.com/arbitrary.pdf",
      ),
    ];

    const plan = planFamilyLibraryBackfill(candidates, {
      attachmentId: null,
      limit: 1,
    });
    assert.deepEqual(plan.selected.map((item) => item.id), [firstId]);
    assert.equal(plan.eligibleCount, 2);
    assert.equal(plan.invalidSourceCount, 2);
  });

  it("can target one exact eligible attachment", () => {
    const targetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const candidates = [
      candidate(
        targetId,
        `https://assets.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/one.pdf`,
      ),
      candidate(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        `https://assets.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/two.pdf`,
      ),
    ];
    const plan = planFamilyLibraryBackfill(candidates, {
      attachmentId: targetId,
      limit: null,
    });
    assert.deepEqual(plan.selected.map((item) => item.id), [targetId]);
  });
});
