import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mayClaimInboundReceipt } from "./inbound-receipt-policy";

const NOW = new Date("2026-07-11T15:30:00.000Z");

describe("durable inbound receipt claims", () => {
  it("accepts a provider message with no prior receipt", () => {
    assert.equal(mayClaimInboundReceipt(null, NOW), true);
  });

  it("rejects a completed provider replay", () => {
    assert.equal(
      mayClaimInboundReceipt(
        {
          status: "completed",
          claimedAt: new Date("2026-07-11T15:20:00.000Z"),
        },
        NOW,
      ),
      false,
    );
  });

  it("rejects a concurrent replay while the first turn is active", () => {
    assert.equal(
      mayClaimInboundReceipt(
        {
          status: "claimed",
          claimedAt: new Date("2026-07-11T15:29:30.000Z"),
        },
        NOW,
      ),
      false,
    );
  });

  it("reclaims a stale interrupted receipt and an explicitly failed one", () => {
    assert.equal(
      mayClaimInboundReceipt(
        {
          status: "claimed",
          claimedAt: new Date("2026-07-11T14:50:00.000Z"),
        },
        NOW,
      ),
      true,
    );
    assert.equal(
      mayClaimInboundReceipt(
        {
          status: "failed",
          claimedAt: new Date("2026-07-11T15:29:30.000Z"),
        },
        NOW,
      ),
      true,
    );
  });
});
