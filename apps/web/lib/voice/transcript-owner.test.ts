import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transcriptOwnerPhone } from "./transcript-owner";

describe("Telnyx transcript ownership", () => {
  it("normalizes the end-user number used for adult ownership", () => {
    assert.equal(
      transcriptOwnerPhone({ telnyx_end_user_target: "(561) 555-0123" }),
      "+15615550123",
    );
  });

  it("never substitutes the assistant number for a missing end user", () => {
    assert.equal(
      transcriptOwnerPhone({ telnyx_agent_target: "+15615550999" }),
      null,
    );
  });

  it("fails closed when the end-user number is outside the US contract", () => {
    assert.equal(
      transcriptOwnerPhone({
        telnyx_end_user_target: "+442079460123",
        telnyx_agent_target: "+15615550999",
      }),
      null,
    );
  });
});
