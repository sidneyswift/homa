import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { kidProgressAction } from "./kid-action";

const originalFlag = process.env.HOMA_LIVE_PROGRESS_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
  } else {
    process.env.HOMA_LIVE_PROGRESS_ENABLED = originalFlag;
  }
});

describe("kidProgressAction", () => {
  it("shows live Progress for every child while enabled", () => {
    process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";

    for (const reportToken of ["report-token", null]) {
      assert.deepEqual(
        kidProgressAction("child-1", reportToken),
        {
          href: "/app/child-1/progress",
          label: "See all progress",
        },
      );
    }
  });

  it("preserves only a real legacy report action while disabled", () => {
    for (const flag of [undefined, "false"]) {
      if (flag === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = flag;
      }
      assert.deepEqual(
        kidProgressAction("child-1", "report-token"),
        {
          href: "/app/child-1/report",
          label: "Open the full report",
        },
      );
      assert.equal(kidProgressAction("child-1", null), null);
    }
  });
});
