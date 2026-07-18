import assert from "node:assert/strict";
import { test } from "node:test";

import { familyDisplayName } from "./format";

test("the create_my_family default reads as never set up", () => {
  assert.equal(familyDisplayName("My family"), "Family not set up");
});

test("a real family name passes through untouched", () => {
  assert.equal(familyDisplayName("McClellan"), "McClellan");
});
