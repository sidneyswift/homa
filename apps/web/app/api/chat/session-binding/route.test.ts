import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { EveMembershipUnavailableError } from "../../../../lib/eve-membership";
import { GET } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";

function mockMembershipBackend(t: TestContext) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://homa-auth.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-publishable-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  });
  t.mock.method(console, "info", () => {});
  const state = {
    userStatus: 200,
    membershipStatus: 504,
    familyId: FAMILY_ID as string | null,
    paths: [] as string[],
  };
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://homa-auth.test");
    state.paths.push(url.pathname);
    if (url.pathname === "/auth/v1/user") {
      return state.userStatus === 200
        ? Response.json({ id: USER_ID, aud: "authenticated" })
        : Response.json({ code: "bad_jwt", message: "Invalid token" }, { status: state.userStatus });
    }
    assert.equal(url.pathname, "/rest/v1/family_members");
    assert.equal(url.searchParams.get("user_id"), `eq.${USER_ID}`);
    assert.equal(url.searchParams.get("select"), "family_id");
    assert.equal(url.searchParams.get("limit"), "1");
    return state.membershipStatus === 200
      ? Response.json(state.familyId ? [{ family_id: state.familyId }] : [])
      : new Response("private upstream Gateway Timeout", { status: state.membershipStatus });
  });
  return state;
}

function request(transport: "bearer" | "cookie" = "bearer") {
  const session = {
    access_token: "synthetic-token",
    refresh_token: "synthetic-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: USER_ID, aud: "authenticated" },
  };
  return new Request("https://homa.test/api/chat/session-binding", {
    headers: transport === "bearer"
      ? { authorization: "Bearer synthetic-token" }
      : { cookie: `sb-homa-auth-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` },
  });
}

test("binding returns a retryable 503 for a membership timeout on bearer and cookie requests", async (t) => {
  const backend = mockMembershipBackend(t);
  for (const transport of ["bearer", "cookie"] as const) {
    const response = await GET(request(transport));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "1");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.has("www-authenticate"), false);
    const body = await response.json();
    assert.equal(body.code, "auth_service_unavailable");
    assert.doesNotMatch(JSON.stringify(body), /private upstream/u);
  }
  assert.deepEqual(backend.paths, [
    "/auth/v1/user", "/rest/v1/family_members",
    "/auth/v1/user", "/rest/v1/family_members",
  ]);
});

test("binding keeps invalid credentials and absent or denied memberships as 401", async (t) => {
  const backend = mockMembershipBackend(t);
  backend.userStatus = 401;
  assert.equal((await GET(request())).status, 401);
  assert.deepEqual(backend.paths, ["/auth/v1/user"]);
  backend.userStatus = 200;
  backend.membershipStatus = 200;
  backend.familyId = null;
  assert.equal((await GET(request())).status, 401);
  for (const status of [401, 403]) {
    backend.membershipStatus = status;
    assert.equal((await GET(request())).status, 401);
  }
});

test("other API family callers retain null on timeout while chat can opt in and recover", async (t) => {
  const backend = mockMembershipBackend(t);
  assert.equal(await resolveApiFamily(request()), null);
  await assert.rejects(
    resolveApiFamily(request(), { transientMembershipErrors: "throw" }),
    EveMembershipUnavailableError,
  );
  backend.membershipStatus = 200;
  const recovered = await resolveApiFamily(request(), { transientMembershipErrors: "throw" });
  assert.equal(recovered?.userId, USER_ID);
  assert.equal(recovered?.familyId, FAMILY_ID);
  assert.deepEqual(backend.paths, [
    "/auth/v1/user", "/rest/v1/family_members",
    "/auth/v1/user", "/rest/v1/family_members",
    "/auth/v1/user", "/rest/v1/family_members",
  ]);
});

test("binding timings separate authentication and membership without changing the failed request", async (t) => {
  const backend = mockMembershipBackend(t);
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const response = await GET(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "1");
  const records = logs.map((row) => JSON.parse(row[1] as string));
  assert.deepEqual(records.map((row) => [row.stage, row.outcome]), [
    ["binding_authenticate", "ok"], ["binding_membership", "error"], ["binding_total", "ok"],
  ]);
  assert.ok(records.every((row) => Number.isFinite(row.startedAtMs)));
  assert.equal(records.at(-1).statusCode, 503);
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-token|private upstream|11111111|22222222/);
  assert.deepEqual(backend.paths, ["/auth/v1/user", "/rest/v1/family_members"]);
});
