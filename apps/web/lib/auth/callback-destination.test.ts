import assert from "node:assert/strict";
import test from "node:test";

import { authCallbackDestination } from "./callback-destination";

test("sends a new OAuth account through onboarding before the app", () => {
  assert.equal(
    authCallbackDestination({ next: "/app", hasLinkedFamily: false }),
    "/onboarding",
  );
});

test("keeps a returning OAuth account on its requested safe path", () => {
  assert.equal(
    authCallbackDestination({ next: "/app", hasLinkedFamily: true }),
    "/app",
  );
});
