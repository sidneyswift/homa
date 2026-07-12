import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import * as progressFlag from "./flag";

const { liveProgressEnabled } = progressFlag;

const originalFlag = process.env.HOMA_LIVE_PROGRESS_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
    return;
  }
  process.env.HOMA_LIVE_PROGRESS_ENABLED = originalFlag;
});

describe("liveProgressEnabled", () => {
  it("exposes no fallback marker or bypass API", () => {
    assert.deepEqual(
      Object.keys(progressFlag).sort(),
      ["liveProgressEnabled"],
    );
  });

  it("enables live Progress for the exact string true", () => {
    process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";

    assert.equal(liveProgressEnabled(), true);
  });

  it("keeps live Progress off when the flag is missing", () => {
    delete process.env.HOMA_LIVE_PROGRESS_ENABLED;

    assert.equal(liveProgressEnabled(), false);
  });

  it("keeps live Progress off for every non-exact value", () => {
    for (const value of ["1", "TRUE", " true", "true ", "false", ""]) {
      process.env.HOMA_LIVE_PROGRESS_ENABLED = value;
      assert.equal(liveProgressEnabled(), false, value);
    }
  });
});
