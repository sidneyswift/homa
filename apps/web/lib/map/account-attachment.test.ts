import assert from "node:assert/strict";
import { test } from "node:test";

import { accountAttachmentTarget } from "./store";

test("a new account claims only its current anonymous family", () => {
  assert.deepEqual(accountAttachmentTarget("new-family", undefined), {
    familyId: "new-family",
    returning: false,
  });
});

test("an existing account resumes its family without folding the new sitting", () => {
  assert.deepEqual(accountAttachmentTarget("new-family", "existing-family"), {
    familyId: "existing-family",
    returning: true,
  });
});
