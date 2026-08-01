import assert from "node:assert/strict";
import { test } from "node:test";

import { familyDisplayName, familyRosterDisplayName } from "./format";

test("the create_my_family default reads as never set up", () => {
  assert.equal(familyDisplayName("My family"), "Family not set up");
});

test("a real family name passes through untouched", () => {
  assert.equal(familyDisplayName("McClellan"), "McClellan");
});

test("the founder roster identifies an unnamed family by parent and email", () => {
  assert.equal(
    familyRosterDisplayName("My family", "Karla", "karla@example.com"),
    "Karla's family",
  );
  assert.equal(
    familyRosterDisplayName("My family", null, "karla@example.com"),
    "karla@example.com",
  );
});

test("the founder roster preserves a chosen family name", () => {
  assert.equal(
    familyRosterDisplayName("The Rocha family", "Karla", "karla@example.com"),
    "The Rocha family",
  );
});
