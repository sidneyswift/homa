import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildResearchBriefLiveJudgeInput } from "./research-brief-live-judge-input";

const BASE_RUBRIC = {
  sourceGrounded: "Use the supplied source.",
  usesExactChildAnchor: "placeholder replaced by builder",
};
const LIVE_EVAL_SOURCE = readFileSync(
  new URL("../../../../scripts/research-brief-format-eval.mts", import.meta.url),
  "utf8",
);

describe("research brief live judge input", () => {
  it("requires a marked anchor to appear quoted once in Why", () => {
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
      /The marked word or phrase "ship" must appear quoted at least once in Why/u,
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

  it("judges Story and Mae CTA concepts without a fixed phrase", () => {
    assert.match(
      LIVE_EVAL_SOURCE,
      /Judge CTA concepts, never one exact phrase or adjective order\./u,
    );
    assert.match(
      LIVE_EVAL_SOURCE,
      /For Story, accept any one word strip that names the supplied word ship or supplied sh pattern and the parent-facing skill\./u,
    );
    assert.match(
      LIVE_EVAL_SOURCE,
      /For Mae, accept an array or practice artifact that names rows and the parent-facing skill\./u,
    );
    assert.doesNotMatch(LIVE_EVAL_SOURCE, /sh-and-ship word strip/u);
  });
});
