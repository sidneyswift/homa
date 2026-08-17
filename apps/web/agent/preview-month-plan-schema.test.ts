import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import { previewMonthPlanInputSchema } from "./tools/preview_month_plan";

const token = "x".repeat(40);

describe("preview_month_plan provider schema", () => {
  it("publishes an object schema accepted by every configured provider", () => {
    const jsonSchema = z.toJSONSchema(previewMonthPlanInputSchema);
    assert.equal(jsonSchema.type, "object");
    assert.ok(jsonSchema.properties?.action);
  });

  it("keeps action-specific fields exact at the deterministic boundary", () => {
    assert.equal(
      previewMonthPlanInputSchema.safeParse({
        action: "restore",
        draftToken: token,
      }).success,
      false,
    );
    assert.equal(
      previewMonthPlanInputSchema.safeParse({
        action: "abandon",
        draftToken: token,
        restoreRevision: 1,
      }).success,
      false,
    );
    assert.equal(
      previewMonthPlanInputSchema.safeParse({
        action: "resume",
      }).success,
      true,
    );
    assert.equal(
      previewMonthPlanInputSchema.safeParse({
        action: "resume",
        workingPlanId: "00000000-0000-4000-8000-000000000003",
      }).success,
      false,
    );
    assert.equal(
      previewMonthPlanInputSchema.safeParse({
        action: "resume",
        draftToken: token,
      }).success,
      false,
    );
  });
});
