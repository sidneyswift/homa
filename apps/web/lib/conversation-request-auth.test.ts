import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";

import { resolveConversationRequestPrincipal } from "./conversation-request-auth";

const memberUserId = randomUUID(), familyId = randomUUID();
function environment(t: TestContext) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic-auth.homa.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-public-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  });
}
const request = () => new Request("https://homa.test/api/conversation/requests", {
  headers: { authorization: "Bearer exact-adult-token", cookie: "other=adult" },
});

test("real Supabase adapter verifies bearer then queries newest live membership under that bearer", async t => {
  environment(t);
  const seen: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const parsed = new URL(url); seen.push(parsed);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer exact-adult-token");
    if (parsed.pathname === "/auth/v1/user") return Response.json({ id: memberUserId });
    assert.equal(parsed.pathname, "/rest/v1/family_members");
    assert.equal(parsed.searchParams.get("user_id"), `eq.${memberUserId}`);
    assert.equal(parsed.searchParams.get("families.status"), "neq.deleted");
    assert.equal(parsed.searchParams.get("order"), "created_at.desc,family_id.asc");
    assert.equal(parsed.searchParams.get("limit"), "1");
    return Response.json([{ family_id: familyId, families: { status: "active" } }]);
  });
  assert.deepEqual(await resolveConversationRequestPrincipal(request()), { familyId, memberUserId });
  assert.equal(seen.length, 2);
});

test("invalid authentication never performs a membership lookup", async t => {
  environment(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++; return Response.json({ message: "invalid token", code: "bad_jwt" }, { status: 401 });
  });
  assert.equal(await resolveConversationRequestPrincipal(request()), null);
  assert.equal(calls, 1);
});

test("membership outage is retryable rather than a missing account", async t => {
  environment(t);
  t.mock.method(globalThis, "fetch", async (url: string) => new URL(url).pathname === "/auth/v1/user"
    ? Response.json({ id: memberUserId })
    : Response.json({ message: "temporary database outage", code: "XX000" }, { status: 503 }));
  await assert.rejects(resolveConversationRequestPrincipal(request()));
});

test("absent bearer cannot fall back to an unrelated browser cookie", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("must not fetch"); });
  assert.equal(await resolveConversationRequestPrincipal(new Request("https://homa.test", {
    headers: { cookie: "other=adult" },
  })), null);
});
