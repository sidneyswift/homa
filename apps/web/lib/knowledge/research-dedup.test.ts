import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalResearchUrl,
  findResearchDuplicates,
  type PriorResearchDossier,
} from "./research-dedup";

const PRIOR: PriorResearchDossier = {
  topicKey: "dimensions-math",
  rows: [
    {
      title: "Dimensions Math review",
      summary: "The program uses a concrete, pictorial, abstract sequence.",
      citations: [
        {
          url: "https://www.reddit.com/r/homeschool/comments/abc123/dimensions_math_review/?utm_source=share",
          claim: "Dimensions Math uses a concrete pictorial abstract sequence.",
        },
      ],
    },
  ],
};

describe("canonicalResearchUrl", () => {
  it("treats tracking variants of one article as the same page", () => {
    assert.equal(
      canonicalResearchUrl(
        "https://www.reddit.com/r/homeschool/comments/abc123/dimensions_math_review/?utm_source=share#comments",
      ),
      canonicalResearchUrl(
        "https://reddit.com/r/homeschool/comments/abc123/dimensions_math_review?utm_medium=social",
      ),
    );
  });

  it("keeps different pages on the same host distinct", () => {
    assert.notEqual(
      canonicalResearchUrl("https://reddit.com/r/homeschool/comments/abc123/first"),
      canonicalResearchUrl("https://reddit.com/r/homeschool/comments/xyz789/second"),
    );
  });
});

describe("findResearchDuplicates", () => {
  it("blocks an article already used for the same topic", () => {
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://reddit.com/r/homeschool/comments/abc123/dimensions_math_review?ref=share",
          claim: "A new unrelated claim.",
        },
      ],
      PRIOR,
    );

    assert.deepEqual(duplicates.urls, [
      "https://reddit.com/r/homeschool/comments/abc123/dimensions_math_review",
    ]);
  });

  it("allows a different article from the same website", () => {
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://reddit.com/r/homeschool/comments/new456/dimensions_math_2026",
          claim: "Parents describe the revised sequence as easier to pace.",
        },
      ],
      PRIOR,
    );

    assert.deepEqual(duplicates.urls, []);
    assert.deepEqual(duplicates.claims, []);
  });

  it("detects a near-repeat of a previously covered claim", () => {
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://example.org/new-study",
          claim: "Dimensions Math follows the concrete pictorial abstract sequence.",
        },
      ],
      PRIOR,
    );

    assert.equal(duplicates.claims.length, 1);
  });
});
