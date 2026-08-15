import assert from "node:assert/strict";
import test from "node:test";

import { classifySignupAttribution } from "./signup-attribution";

const userCreatedAt = "2026-08-15T12:00:00.000Z";

test("classifies Auth accounts without a linked family separately", () => {
  assert.equal(
    classifySignupAttribution({ userCreatedAt, familyCreatedAt: null, sandbox: false }),
    "unlinked_account",
  );
});

test("keeps sandbox accounts out of the new-family denominator", () => {
  assert.equal(
    classifySignupAttribution({
      userCreatedAt,
      familyCreatedAt: "2026-08-15T12:01:00.000Z",
      sandbox: true,
    }),
    "sandbox_family",
  );
});

test("distinguishes a new family from an existing-family link", () => {
  assert.equal(
    classifySignupAttribution({
      userCreatedAt,
      familyCreatedAt: "2026-08-15T11:57:00.000Z",
      sandbox: false,
    }),
    "new_family",
  );
  assert.equal(
    classifySignupAttribution({
      userCreatedAt,
      familyCreatedAt: "2026-08-15T11:54:00.000Z",
      sandbox: false,
    }),
    "existing_family",
  );
});
