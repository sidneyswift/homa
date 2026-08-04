import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import { completePlannerActivityInputSchema } from "./tools/complete_planner_activity";

const SOURCE_QUOTE = "We finished Horizons lesson 42.";

describe("complete_planner_activity provider schema", () => {
  it("publishes one root object accepted by every configured provider", () => {
    const jsonSchema = z.toJSONSchema(completePlannerActivityInputSchema);
    assert.equal(jsonSchema.type, "object");
    assert.ok(jsonSchema.properties?.targetKind);
  });

  it("keeps target-specific identities exact after the shared object parses", () => {
    assert.equal(
      completePlannerActivityInputSchema.safeParse({
        targetKind: "logged_activity",
        activityId: "11111111-1111-4111-8111-111111111111",
        sourceQuote: SOURCE_QUOTE,
      }).success,
      true,
    );
    assert.equal(
      completePlannerActivityInputSchema.safeParse({
        targetKind: "logged_activity",
        activityId: "11111111-1111-4111-8111-111111111111",
        childId: "22222222-2222-4222-8222-222222222222",
        sourceQuote: SOURCE_QUOTE,
      }).success,
      false,
    );
    assert.equal(
      completePlannerActivityInputSchema.safeParse({
        targetKind: "generated_plan_activity",
        sourceQuote: SOURCE_QUOTE,
      }).success,
      false,
    );
  });
});
