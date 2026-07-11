import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { providerMessageIdForRole } from "./ledger";

describe("provider message attribution", () => {
  it("stores the inbound provider id on the parent message only", () => {
    assert.equal(
      providerMessageIdForRole("user", "provider-inbound-42"),
      "provider-inbound-42",
    );
    assert.equal(
      providerMessageIdForRole("assistant", "provider-inbound-42"),
      null,
    );
  });
});
