import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { retryProgressPage } from "./retry-progress-action";

describe("retryProgressPage", () => {
  it("refreshes the current route without navigating", () => {
    const calls: string[] = [];

    retryProgressPage({
      refresh: () => {
        calls.push("refresh");
      },
    });

    assert.deepEqual(calls, ["refresh"]);
  });
});
