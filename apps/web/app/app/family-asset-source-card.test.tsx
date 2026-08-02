import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  FamilyAssetSourceCard,
  parseFamilyAssetSourceCardPart,
} from "./family-asset-source-card";

const ASSET_ID = "40000000-0000-4000-8000-000000000001";

function part(overrides: Record<string, unknown> = {}) {
  return {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "get_family_asset",
    output: {
      found: true,
      asset: {
        id: ASSET_ID,
        title: "Forest habitats workbook",
        resourceKind: "curriculum",
        children: [{ id: "child-1", name: "Mia" }],
        libraryUrl: "https://untrusted.example/source",
        ...overrides,
      },
    },
  };
}

describe("FamilyAssetSourceCard", () => {
  it("parses an authenticated retrieval and rebuilds its exact Library link", () => {
    const source = parseFamilyAssetSourceCardPart(part());
    assert.deepEqual(source, {
      id: ASSET_ID,
      title: "Forest habitats workbook",
      libraryUrl: `/app/library?asset=${ASSET_ID}`,
      kindLabel: "Curriculum",
      childNames: ["Mia"],
    });
    const html = renderToStaticMarkup(<FamilyAssetSourceCard source={source!} />);
    assert.match(html, /Library source/u);
    assert.match(html, /Forest habitats workbook/u);
    assert.match(html, /Curriculum · for Mia/u);
    assert.doesNotMatch(html, /untrusted\.example/u);
  });

  it("rejects failed retrievals and malformed source identity", () => {
    assert.equal(
      parseFamilyAssetSourceCardPart({
        ...part(),
        output: { found: false },
      }),
      null,
    );
    assert.equal(parseFamilyAssetSourceCardPart(part({ id: "not-an-id" })), null);
  });
});
