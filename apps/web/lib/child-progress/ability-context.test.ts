import assert from "node:assert/strict";
import test from "node:test";

import {
  ABILITY_CONTEXT_COOKIE,
  encodeAbilityContext,
  readAbilityContextCookie,
} from "./ability-context";

const value = {
  childId: "11111111-1111-4111-8111-111111111111",
  abilityId: "math.fractions.equivalent",
};

test("ability context cookie round-trips through a request header", () => {
  const encoded = encodeAbilityContext(value);
  assert.deepEqual(
    readAbilityContextCookie(`${ABILITY_CONTEXT_COOKIE}=${encoded}`),
    value,
  );
});

test("ability context cookie drops malformed or oversized values", () => {
  assert.equal(readAbilityContextCookie(null), null);
  assert.equal(readAbilityContextCookie(`${ABILITY_CONTEXT_COOKIE}=%`), null);
  assert.equal(
    readAbilityContextCookie(
      `${ABILITY_CONTEXT_COOKIE}=${"x".repeat(600)}`,
    ),
    null,
  );
});
