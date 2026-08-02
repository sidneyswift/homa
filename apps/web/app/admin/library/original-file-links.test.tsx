import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OriginalFileLinks } from "./original-file-links";

describe("OriginalFileLinks", () => {
  it("renders every retained multipart original as a named link", () => {
    const html = renderToStaticMarkup(
      <OriginalFileLinks
        files={[
          {
            url: "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/inspo/cur-a/volume-1.pdf",
            name: "volume-1.pdf",
            size: 2_000_000,
          },
          {
            url: "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/inspo/cur-a/volume-2.pdf",
            name: "volume-2.pdf",
            size: 1_000_000,
          },
        ]}
      />,
    );

    assert.equal((html.match(/<a /g) ?? []).length, 2);
    assert.match(html, /href="https:\/\/pkvvudjdhxk33dig[^\"]+\/volume-1\.pdf"/);
    assert.match(html, /href="https:\/\/pkvvudjdhxk33dig[^\"]+\/volume-2\.pdf"/);
    assert.match(html, /aria-label="Open original file 1 of 2: volume-1\.pdf"/);
    assert.match(html, /aria-label="Open original file 2 of 2: volume-2\.pdf"/);
  });
});
