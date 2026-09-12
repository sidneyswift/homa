import assert from "node:assert/strict";
import { test } from "node:test";

import { routeAuth } from "eve/channels/auth";

import { readEveMembership } from "./eve-membership";

test("transient membership failures return a retryable 503 without exposing upstream details", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  for (const status of [0, 408, 429, 500, 502, 503, 504, 520]) {
    let reads = 0;
    let fallbackCalls = 0;
    const response = await routeAuth(new Request("https://homa.test/eve/v1/session"), [
      async () => {
        await readEveMembership(async () => {
          reads += 1;
          return { data: null, error: { message: "private-upstream-detail" }, status };
        });
        assert.fail("Unavailable membership must not grant access");
      },
      () => {
        fallbackCalls += 1;
        return null;
      },
    ]);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("retry-after"), "1");
    assert.equal(response.headers.has("www-authenticate"), false);
    const body = await response.json();
    assert.equal(body.code, "auth_service_unavailable");
    assert.equal(body.ok, false);
    assert.doesNotMatch(JSON.stringify(body), /private-upstream-detail/u);
    assert.equal(reads, 1, "the membership boundary must not add retries");
    assert.equal(fallbackCalls, 0, "an outage must stop the auth walk");
  }
  assert.equal(logs.length, 8);
  for (const log of logs) {
    const metadata = JSON.parse(log[1] as string);
    assert.equal(metadata.stage, "membership");
    assert.equal(metadata.outcome, "error");
  }
  assert.doesNotMatch(JSON.stringify(logs), /private-upstream-detail/u);
});

test("membership denials keep the existing auth fallback and 401 response", async (t) => {
  t.mock.method(console, "info", () => {});
  for (const status of [400, 401, 403, 404, 406]) {
    const denied = { data: null, error: { message: "denied" }, status };
    let fallbackCalls = 0;
    const response = await routeAuth(new Request("https://homa.test/eve/v1/session"), [
      async () => {
        const result = await readEveMembership(async () => denied);
        assert.equal(result, denied);
        return null;
      },
      () => {
        fallbackCalls += 1;
        return null;
      },
    ]);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("www-authenticate"), "Bearer");
    assert.equal(response.headers.has("retry-after"), false);
    assert.equal(fallbackCalls, 1);
  }
});

test("successful and missing memberships preserve their exact results", async (t) => {
  t.mock.method(console, "info", () => {});
  for (const data of [null, { family_id: "family-test", display_name: "Parent" }]) {
    const result = { data, error: null, status: 200 };
    assert.equal(await readEveMembership(async () => result), result);
  }
});
