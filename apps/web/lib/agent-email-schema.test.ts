import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { agentEmailSchema } from "./agent-email-schema";

describe("model-facing email schema", () => {
  it("advertises a plain bounded string without unsupported regex features", () => {
    const schema = z.toJSONSchema(agentEmailSchema.max(254));
    assert.equal(schema.type, "string");
    assert.equal(schema.maxLength, 254);
    assert.equal(schema.pattern, undefined);
  });

  it("retains strict email validation before a tool can execute", () => {
    for (const email of ["parent@example.com", "parent+school@example.co.uk"]) {
      assert.equal(agentEmailSchema.max(254).safeParse(email).success, true);
    }
    for (const email of ["", "not-an-email", ".parent@example.com", "a..b@example.com", "a@localhost", "a@example.com\n", `${"a".repeat(250)}@example.com`]) {
      assert.equal(agentEmailSchema.max(254).safeParse(email).success, false, email);
    }
  });

  it("keeps optional lead email and required signup email behavior", () => {
    assert.equal(z.object({ email: agentEmailSchema.max(254).optional() }).safeParse({}).success, true);
    assert.equal(z.object({ email: agentEmailSchema.max(254) }).safeParse({}).success, false);
    assert.equal(agentEmailSchema.safeParse(null).success, false);
  });
});
