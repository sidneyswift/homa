import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeResearchWaitFailure,
  ResearchRunWaitTimeoutError,
} from "./research-operations.mts";

describe("ResearchRunWaitTimeoutError", () => {
  it("carries the run count and deadline that actually expired", () => {
    const error = new ResearchRunWaitTimeoutError(2, 20 * 60_000);

    assert.ok(error instanceof Error);
    assert.equal(error.name, "ResearchRunWaitTimeoutError");
    assert.equal(error.runCount, 2);
    assert.equal(error.timeoutMs, 20 * 60_000);
    assert.equal(
      error.message,
      "Timed out waiting for 2 research run(s) after 1200000ms.",
    );
  });
});

describe("describeResearchWaitFailure", () => {
  it("keeps a real deadline expiry labeled as a timeout", () => {
    const error = new ResearchRunWaitTimeoutError(2, 20 * 60_000);

    assert.deepEqual(describeResearchWaitFailure(error), {
      kind: "timeout",
      cancellationReason:
        "cancelled by condensed research lab after 20 minute timeout",
      reportAction: "timed out",
      detail: "Timed out waiting for 2 research run(s) after 1200000ms.",
    });
  });

  it("labels an ordinary database exception as a polling failure", () => {
    const detail = 'malformed array literal: "run-id"';
    const description = describeResearchWaitFailure(new Error(detail));

    assert.deepEqual(description, {
      kind: "polling",
      cancellationReason:
        `cancelled by condensed research lab because polling failed: ${detail}`,
      reportAction: "polling failed",
      detail,
    });
    assert.doesNotMatch(description.cancellationReason, /timeout/iu);
  });
});
