import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { routeAuth } from "eve/channels/auth";

import { EveAuthServiceUnavailableError, readEveAuthentication } from "./eve-authentication";

test("temporary Auth failures stop Eve admission with one read and no fallback", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const errors = [
    new AuthRetryableFetchError("private Auth detail", 0),
    new AuthRetryableFetchError("private Auth detail", 504),
    ...[408, 429, 500, 503, 520].map(status => new AuthApiError("private Auth detail", status, "unexpected_failure")),
  ];
  for (const error of errors) {
    let reads = 0;
    let fallbacks = 0;
    const response = await routeAuth(new Request("https://homa.test/eve/v1/session"), [
      async () => {
        await readEveAuthentication(async () => {
          reads += 1;
          return { data: { user: null }, error };
        }, "authenticate");
        assert.fail("Unavailable Auth must not admit a turn");
      },
      () => { fallbacks += 1; return null; },
    ]);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "1");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.has("www-authenticate"), false);
    const body = await response.json();
    assert.equal(body.code, "auth_service_unavailable");
    assert.doesNotMatch(JSON.stringify(body), /private Auth detail/);
    assert.equal(reads, 1);
    assert.equal(fallbacks, 0);
  }
  assert.equal(logs.length, errors.length);
  for (const log of logs) {
    const metadata = JSON.parse(log[1] as string);
    assert.equal(metadata.stage, "authenticate");
    assert.equal(metadata.outcome, "error");
  }
  assert.doesNotMatch(JSON.stringify(logs), /private Auth detail/);
});

test("permanent Auth denials keep their exact result and Eve's unauthorized response", async () => {
  for (const error of [
    new AuthApiError("Invalid JWT", 401, "bad_jwt"),
    new AuthApiError("User banned", 403, "user_banned"),
    new AuthApiError("User missing", 404, "user_not_found"),
    new AuthSessionMissingError(),
  ]) {
    const result = { data: { user: null }, error };
    assert.equal(await readEveAuthentication(async () => result), result);
    const response = await routeAuth(new Request("https://homa.test/eve/v1/session"), [
      async () => {
        const { data } = await readEveAuthentication(async () => result);
        assert.equal(data.user, null);
        return null;
      },
    ]);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 401);
    assert.equal(response.headers.has("retry-after"), false);
  }
});

test("thrown SDK transient errors are classified while unrelated exceptions stay unchanged", async () => {
  await assert.rejects(
    readEveAuthentication(async () => { throw new AuthRetryableFetchError("private", 0); }),
    EveAuthServiceUnavailableError,
  );
  const error = Object.assign(new Error("programming failure"), { status: 503 });
  await assert.rejects(readEveAuthentication(async () => { throw error; }), candidate => candidate === error);
});

test("successful and missing Auth results are returned unchanged", async () => {
  for (const user of [null, { id: "synthetic-user" }]) {
    const result = { data: { user }, error: null };
    assert.equal(await readEveAuthentication(async () => result), result);
  }
});
