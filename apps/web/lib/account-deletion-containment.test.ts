import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET, POST } from "../app/api/account-deletion/route";

const expectedBody = {
  ok: false,
  state: "rejected",
  reason: "temporarily-unavailable",
  message:
    "Account deletion is temporarily unavailable while Homa repairs the final deletion step. Your account and family data have not changed. Billing continues unless you cancel it separately. Email hello@thankshoma.com to request deletion now.",
};

describe("account deletion containment route", () => {
  for (const [method, handler] of [
    ["GET", GET],
    ["POST", POST],
  ] as const) {
    it(`${method} fails closed before any caller input is needed`, async () => {
      const response = await handler();

      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), expectedBody);
    });
  }
});
