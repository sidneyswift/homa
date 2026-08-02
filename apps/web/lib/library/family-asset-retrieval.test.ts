import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { familyAttachmentLibraryPath } from "./family-asset-promotion";
import { familyAssetMatchReason } from "./family-asset-retrieval";

describe("Family Library retrieval contracts", () => {
  it("labels exact matches ahead of semantic and structured-only matches", () => {
    assert.equal(
      familyAssetMatchReason(
        { lexical_rank: "0.42", semantic_distance: "0.18" },
        true,
      ),
      "keyword",
    );
    assert.equal(
      familyAssetMatchReason(
        { lexical_rank: 0, semantic_distance: "0.24" },
        true,
      ),
      "meaning",
    );
    assert.equal(
      familyAssetMatchReason(
        { lexical_rank: null, semantic_distance: null },
        false,
      ),
      "structured",
    );
  });

  it("keeps promoted attachment paths stable and inside one family", () => {
    assert.equal(
      familyAttachmentLibraryPath({
        familyId: "11111111-1111-4111-8111-111111111111",
        attachmentId: "22222222-2222-4222-8222-222222222222",
        originalName: "../../Math Week 1.pdf",
      }),
      "families/11111111-1111-4111-8111-111111111111/library/chat/22222222-2222-4222-8222-222222222222/Math-Week-1.pdf",
    );
  });
});
