import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildResearchBriefLiveJudgeInput } from "./research-brief-live-judge-input";

const BASE_RUBRIC = {
  sourceGrounded: "Use the supplied source.",
  usesExactChildAnchor: "placeholder replaced by builder",
};

describe("research brief live judge input", () => {
  it("requires quotation only for an evidence anchor marked as quoted", () => {
    const input = buildResearchBriefLiveJudgeInput({
      draft: "Story said \"ship\" sounds choppy.",
      evidence: {
        exactEvidenceAnchors: [
          'reads Bob Books and says "ship" can sound choppy',
        ],
        quotationRequiredEvidenceAnchors: ["ship"],
      },
      rubric: BASE_RUBRIC,
    });

    assert.match(
      input.rubric.usesExactChildAnchor,
      /The marked word or phrase "ship" must remain quoted/u,
    );
  });

  it("accepts an exact non-word anchor without inventing a quotation requirement", () => {
    const input = buildResearchBriefLiveJudgeInput({
      draft: "Mae is working on multiplication arrays.",
      evidence: {
        exactEvidenceAnchors: ["is working on multiplication arrays"],
        quotationRequiredEvidenceAnchors: [],
      },
      rubric: BASE_RUBRIC,
    });

    assert.match(
      input.rubric.usesExactChildAnchor,
      /No evidence anchor is marked as requiring quotation/u,
    );
    assert.doesNotMatch(
      input.rubric.usesExactChildAnchor,
      /must remain quoted/u,
    );
  });
});
