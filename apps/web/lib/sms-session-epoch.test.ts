import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSmsSessionThreadId,
  stripSmsSessionEpoch,
} from "./sms-session-epoch";

const TELNYX_THREAD = "telnyx:+13467588011:+15551234567";

describe("SMS session access epochs", () => {
  it("keeps the same access boundary on the same durable session", () => {
    assert.equal(
      buildSmsSessionThreadId(TELNYX_THREAD, "family:one"),
      buildSmsSessionThreadId(TELNYX_THREAD, "family:one"),
    );
  });

  it("rotates the Eve session when the phone's access boundary changes", () => {
    assert.notEqual(
      buildSmsSessionThreadId(TELNYX_THREAD, "family:one"),
      buildSmsSessionThreadId(TELNYX_THREAD, "family:two"),
    );
    assert.notEqual(
      buildSmsSessionThreadId(TELNYX_THREAD, "family:one"),
      buildSmsSessionThreadId(TELNYX_THREAD, "unlinked"),
    );
  });

  it("rotates repeated access to the same family after removal", () => {
    assert.notEqual(
      buildSmsSessionThreadId(TELNYX_THREAD, "family-phone:row-one"),
      buildSmsSessionThreadId(TELNYX_THREAD, "family-phone:row-two"),
    );
    assert.notEqual(
      buildSmsSessionThreadId(TELNYX_THREAD, "phone-access:epoch-one"),
      buildSmsSessionThreadId(TELNYX_THREAD, "phone-access:epoch-two"),
    );
  });

  it("does not expose the raw family or invitation id in the thread key", () => {
    const result = buildSmsSessionThreadId(
      TELNYX_THREAD,
      "family:private-family-id",
    );

    assert.doesNotMatch(result, /private-family-id/u);
  });

  it("strips the epoch before the Telnyx adapter decodes the real thread", () => {
    const tagged = buildSmsSessionThreadId(TELNYX_THREAD, "invite:invite-id");

    assert.equal(stripSmsSessionEpoch(tagged), TELNYX_THREAD);
    assert.equal(stripSmsSessionEpoch(TELNYX_THREAD), TELNYX_THREAD);
  });
});
