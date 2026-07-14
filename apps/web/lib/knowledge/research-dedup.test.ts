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

  it("detects a short exact claim", () => {
    const prior: PriorResearchDossier = {
      topicKey: "dimensions-math",
      rows: [
        {
          title: "Pricing",
          summary: "Pricing changed.",
          citations: [
            {
              url: "https://example.com/old-pricing",
              claim: "Pricing changed in 2026.",
            },
          ],
        },
      ],
    };
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://example.org/new-pricing",
          claim: "Pricing changed in 2026.",
        },
      ],
      prior,
    );

    assert.deepEqual(duplicates.claims, ["Pricing changed in 2026."]);
  });

  it("does not treat an opposite-polarity claim as a repeat", () => {
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://example.org/correction",
          claim:
            "Dimensions Math does not use a concrete pictorial abstract sequence.",
        },
      ],
      PRIOR,
    );

    assert.deepEqual(duplicates.claims, []);
  });

  it("recognizes contractions as opposite polarity", () => {
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://example.org/correction-two",
          claim:
            "Dimensions Math isn't based on a concrete pictorial abstract sequence.",
        },
      ],
      PRIOR,
    );

    assert.deepEqual(duplicates.claims, []);
  });

  it("allows a changed numeric finding with otherwise similar words", () => {
    const prior: PriorResearchDossier = {
      topicKey: "dimensions-math",
      rows: [
        {
          title: "Old price",
          summary: "One level cost 100 dollars.",
          citations: [
            {
              url: "https://example.com/2025-price",
              claim: "One Dimensions Math level costs 100 dollars.",
            },
          ],
        },
      ],
    };
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://example.com/2026-price",
          claim: "One Dimensions Math level costs 120 dollars.",
        },
      ],
      prior,
    );

    assert.deepEqual(duplicates.claims, []);
  });

  it("allows a changed spelled-out quantity", () => {
    const prior: PriorResearchDossier = {
      topicKey: "dimensions-math",
      rows: [
        {
          title: "Old lesson count",
          summary: "The level had twenty lessons.",
          citations: [
            {
              url: "https://example.com/old-lessons",
              claim: "The Dimensions Math level contains twenty lessons.",
            },
          ],
        },
      ],
    };
    const duplicates = findResearchDuplicates(
      [
        {
          url: "https://example.com/new-lessons",
          claim: "The Dimensions Math level contains thirty lessons.",
        },
      ],
      prior,
    );

    assert.deepEqual(duplicates.claims, []);
  });
});
