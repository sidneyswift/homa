import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveActiveSmsProgressContext,
} from "./active-sms-progress-context";

describe("active SMS progress context", () => {
  it("performs no database work while live Progress is disabled", async () => {
    const previous = process.env.HOMA_LIVE_PROGRESS_ENABLED;
    delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
    try {
      assert.equal(
        await resolveActiveSmsProgressContext({
          familyId:
            "11111111-1111-4111-8111-111111111111",
          memberUserId: null,
          phoneNumber: "+15555550100",
        }),
        null,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = previous;
      }
    }
  });
});
