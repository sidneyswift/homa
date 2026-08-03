import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requestAuthTransport } from "./api-auth";

function request(authorization?: string): Request {
  return new Request("https://homa.example/api/map/plan/check", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("requestAuthTransport", () => {
  it("uses cookies only when the Authorization header is absent", () => {
    assert.deepEqual(requestAuthTransport(request()), { kind: "cookie" });
  });

  it("accepts one RFC bearer token without changing its bytes", () => {
    assert.deepEqual(
      requestAuthTransport(request("Bearer eyJhbGciOi.test_token.signature")),
      { kind: "bearer", token: "eyJhbGciOi.test_token.signature" },
    );
  });

  it("fails closed on every present malformed authorization value", () => {
    for (const value of [
      "",
      "Basic browser-cookie-fallback",
      "Bearer",
      "Bearer  two-spaces",
      "Bearer one, Bearer two",
      "Bearer token with spaces",
    ]) {
      assert.deepEqual(requestAuthTransport(request(value)), { kind: "invalid" });
    }
  });
});
