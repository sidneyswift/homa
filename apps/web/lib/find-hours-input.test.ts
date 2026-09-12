import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import findHours from "../agent/tools/find_hours";

const inputSchema = findHours.inputSchema as z.ZodType<Record<string, unknown>>;
const optionalFilters = ["childId", "from", "through", "subject", "categoryId"] as const;

describe("find_hours optional filters", () => {
  it("accepts omission and normalizes only explicit null to undefined", () => {
    const omitted = inputSchema.parse({});
    const normalized = inputSchema.parse(Object.fromEntries(optionalFilters.map(key => [key, null])));
    for (const key of optionalFilters) {
      assert.equal(omitted[key], undefined);
      assert.equal(normalized[key], undefined);
    }
    for (const key of ["period", "includeShared", "uncategorizedOnly", "limit"] as const) {
      assert.equal(normalized[key], omitted[key]);
    }
    assert.deepEqual(omitted, { period: "week", includeShared: true, uncategorizedOnly: false, limit: 20 });
  });

  it("preserves valid nonnull filters, including IDs that still require ownership validation", () => {
    const filters = { childId: "b2222222-2222-4222-8222-222222222222", from: "2026-09-12", through: "2026-09-12", subject: "math", categoryId: "c3333333-3333-4333-8333-333333333333" };
    const parsed = inputSchema.parse(filters);
    for (const key of optionalFilters) assert.equal(parsed[key], filters[key]);
  });

  it("does not coerce other invalid values or make defaulted fields nullable", () => {
    for (const input of [{ childId: "invalid" }, { categoryId: "invalid" }, { subject: "invented" }, { from: 0 }, { through: false },
      { period: null }, { includeShared: null }, { uncategorizedOnly: null }, { limit: null }, { limit: 51 }]) {
      assert.equal(inputSchema.safeParse(input).success, false);
    }
  });

  it("advertises nullable input while keeping optional fields optional", () => {
    const schema = z.toJSONSchema(inputSchema, { target: "draft-7", io: "input" });
    for (const key of optionalFilters) {
      assert.equal(schema.required?.includes(key) ?? false, false);
      const property = schema.properties?.[key];
      assert.ok(property && typeof property === "object");
      assert.ok(property.anyOf?.some(branch => typeof branch === "object" && branch.type === "null"), key);
    }
  });
});
