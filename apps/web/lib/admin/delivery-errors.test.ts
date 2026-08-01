import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isStopBlockedError, STOP_ERROR_PATTERNS } from "./delivery-errors";

describe("isStopBlockedError", () => {
  it("matches both STOP shapes seen live", () => {
    assert.equal(
      isStopBlockedError("Telnyx rejected the send: 40300 Blocked due to STOP message"),
      true,
    );
    assert.equal(
      isStopBlockedError(
        "Failed to send message: Blocked due to STOP message · block rule · 40300",
      ),
      true,
    );
    assert.equal(isStopBlockedError("SMS suppressed (inbound-stop)"), true);
  });

  it("leaves real failures alone", () => {
    assert.equal(
      isStopBlockedError("Telnyx rejected the send: 40309 Invalid destination region"),
      false,
    );
    assert.equal(isStopBlockedError("SMS over the carrier size limit (11 segments, max 10)"), false);
    assert.equal(isStopBlockedError("email.bounced"), false);
    assert.equal(isStopBlockedError(null), false);
  });

  it("keeps the SQL patterns and the JS twin in sync", () => {
    // The SQL side matches with ilike; the JS side must agree on the
    // same two signatures, nothing more.
    assert.deepEqual([...STOP_ERROR_PATTERNS], [
      "%40300%",
      "%stop message%",
      "%inbound-stop%",
    ]);
  });
});
