import assert from "node:assert/strict";
import test from "node:test";

import { signInErrorMessage } from "./auth-copy";

test("sign-in maps only the known OAuth failure to truthful recovery copy", () => {
  assert.match(signInErrorMessage("oauth") ?? "", /Google/u);
  assert.equal(signInErrorMessage("unknown"), null);
  assert.equal(signInErrorMessage(undefined), null);
});
