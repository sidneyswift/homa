import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseLibrarySourceCardPart } from "./library-source-card-model";

const ASSET_ID = "50000000-0000-4000-8000-000000000001";

describe("parseLibrarySourceCardPart", () => {
  it("accepts the bounded server retrieval payload", () => {
    const source = parseLibrarySourceCardPart({
      type: "dynamic-tool",
      state: "output-available",
      toolName: "get_family_asset",
      output: {
        found: true,
        asset: {
          id: ASSET_ID,
          title: "Nature reader",
          libraryUrl: `https://thankshoma.com/app/library?asset=${ASSET_ID}`,
          resourceKind: "book",
          children: [],
        },
      },
    });
    assert.deepEqual(source, {
      id: ASSET_ID,
      title: "Nature reader",
      libraryUrl: `https://thankshoma.com/app/library?asset=${ASSET_ID}`,
      kindLabel: "Book",
      childNames: [],
    });
  });

  it("rejects non-web links", () => {
    assert.equal(
      parseLibrarySourceCardPart({
        type: "dynamic-tool",
        state: "output-available",
        toolName: "get_family_asset",
        output: {
          found: true,
          asset: {
            id: ASSET_ID,
            title: "Nature reader",
            libraryUrl: "javascript:alert(1)",
          },
        },
      }),
      null,
    );
  });
});
