import assert from "node:assert/strict";
import { test } from "node:test";

import { protectEveSessionHandleOperation, type SessionHandleRouteArgs } from "./eve-session-handle-authorization";
import type { EveSessionRouteAuthResult } from "./eve-session-route-auth";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const OTHER_FAMILY = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const SESSION = "owned-session";
const request = new Request("https://homa.test/eve/v1/session/owned-session", {
  method: "POST", headers: { "x-family-id": OTHER_FAMILY },
});
function auth(familyId = FAMILY, memberUserId = MEMBER): EveSessionRouteAuthResult {
  return {
    authenticator: "app", principalType: "user", principalId: memberUserId,
    attributes: { familyId, memberUserId },
  };
}
const operations = [
  ["POST", "/eve/v1/session/:sessionId"],
  ["POST", "/eve/v1/session/:sessionId/cancel"],
  ["POST", "/eve/v1/session/:sessionId/compact"],
  ["POST", "/eve/v1/session/:sessionId/clear"],
  ["POST", "/eve/v1/session/:sessionId/reset"],
  ["GET", "/eve/v1/session/:sessionId/stream"],
  ["GET", "/eve/v1/session/:parentSessionId/subagents/:callId/:childSessionId/stream"],
] as const;

for (const [method, path] of operations) {
  test(`${method} ${path}: only the verified owning family can reach the operation`, async () => {
    let handlerCalls = 0;
    let attachCalls = 0;
    let verifiedAuth = auth();
    const args = {
      params: { sessionId: SESSION, parentSessionId: SESSION, childSessionId: "child", callId: "call" },
      attachSession(id: string) { attachCalls++; return { id }; },
    };
    const guarded = protectEveSessionHandleOperation({
      method, path,
      async handler(_request, context: typeof args) {
        handlerCalls++;
        return Response.json(context.attachSession(SESSION));
      },
    }, {
      resolveAuth: async () => verifiedAuth,
      owns: async (owner) => owner.sessionId === SESSION && owner.familyId === FAMILY && owner.memberUserId === MEMBER,
    });
    assert.equal((await guarded.handler(request, args)).status, 200);
    assert.equal(handlerCalls, 1);
    assert.equal(attachCalls, 1);
    verifiedAuth = auth(OTHER_FAMILY);
    const denied = await guarded.handler(request, args);
    assert.equal(denied.status, 404);
    assert.equal(denied.headers.get("cache-control"), "no-store");
    verifiedAuth = auth(FAMILY, "44444444-4444-4444-8444-444444444444");
    assert.equal((await guarded.handler(request, args)).status, 404);
    assert.equal(handlerCalls, 1, "denied requests must not perform the operation");
    assert.equal(attachCalls, 1, "denied requests must not attach a runtime handle");
  });
}

function fixture(input: {
  resolveAuth?: () => Promise<EveSessionRouteAuthResult>;
  owns?: () => Promise<boolean>;
  handler?: (_request: Request, args: SessionHandleRouteArgs) => Promise<Response>;
} = {}) {
  let calls = 0;
  const route = protectEveSessionHandleOperation({
    method: "POST", path: "/eve/v1/session/:sessionId/cancel",
    handler: input.handler ?? (async () => { calls++; return new Response("completed"); }),
  }, { resolveAuth: input.resolveAuth ?? (async () => auth()), owns: input.owns ?? (async () => true) });
  const args: SessionHandleRouteArgs = { params: { sessionId: SESSION }, attachSession: (id) => ({ id }) };
  return { route, args, calls: () => calls };
}

test("membership is checked again for each operation after revocation", async () => {
  let owned = true;
  const f = fixture({ owns: async () => owned });
  assert.equal((await f.route.handler(request, f.args)).status, 200);
  owned = false;
  assert.equal((await f.route.handler(request, f.args)).status, 404);
  assert.equal(f.calls(), 1);
});

test("an ownership-store outage performs no operation", async () => {
  const f = fixture({ owns: async () => { throw new Error("database unavailable"); } });
  const response = await f.route.handler(request, f.args);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(f.calls(), 0);
});

test("auth denial, mismatched principal, and auth exceptions never reach the operation", async () => {
  for (const resolveAuth of [
    async () => new Response("Unauthorized", { status: 401 }),
    async () => ({ ...auth(), principalId: "not-the-verified-member" }),
    async () => { throw new Error("auth unavailable"); },
  ]) {
    const f = fixture({ resolveAuth });
    assert.notEqual((await f.route.handler(request, f.args)).status, 200);
    assert.equal(f.calls(), 0);
  }
});

test("blank, oversized, and whitespace-modified session IDs fail before lookup", async () => {
  let lookups = 0;
  const f = fixture({ owns: async () => { lookups++; return true; } });
  for (const id of ["", " ", " owned-session", "owned-session ", "s".repeat(256)]) {
    assert.equal((await f.route.handler(request, { ...f.args, params: { sessionId: id } })).status, 404);
  }
  assert.equal(lookups, 0);
  assert.equal(f.calls(), 0);
});

test("a handler cannot switch to another session, even if it catches the refusal", async () => {
  let attaches = 0;
  const f = fixture({ handler: async (_request, args) => {
    try { args.attachSession("another-family-session"); } catch { /* Simulates upstream catch. */ }
    return new Response("must not escape");
  } });
  const response = await f.route.handler(request, {
    ...f.args, attachSession: () => { attaches++; return {}; },
  });
  assert.equal(response.status, 404);
  assert.equal(attaches, 0);
  assert.doesNotMatch(await response.text(), /must not escape/);
});

test("child-stream authorization is based on the parent, with no child-ID shortcut", async () => {
  let lookedUp = "";
  const route = protectEveSessionHandleOperation({
    method: "GET", path: operations[6][1],
    handler: async (_request, args: SessionHandleRouteArgs) => {
      args.attachSession(args.params.parentSessionId);
      // The Eve handler still owns matching child ID and call ID to parent events.
      return new Response("No matching child", { status: 404 });
    },
  }, { resolveAuth: async () => auth(), owns: async (owner) => { lookedUp = owner.sessionId; return true; } });
  assert.equal((await route.handler(request, {
    params: { parentSessionId: SESSION, childSessionId: "foreign-child", callId: "foreign-call" },
    attachSession: (id) => ({ id }),
  })).status, 404);
  assert.equal(lookedUp, SESSION);
});

test("creation, unknown routes, wrong methods, and WebSockets need separate authorization", () => {
  for (const route of [
    { method: "POST", path: "/eve/v1/session" },
    { method: "DELETE", path: "/eve/v1/session/:sessionId" },
    { method: "POST", path: "/eve/v1/session/:sessionId/export" },
    { method: "POST", path: operations[0][1], transport: "websocket" },
  ]) {
    assert.throws(() => protectEveSessionHandleOperation({ ...route, handler: async () => new Response() }, {
      resolveAuth: async () => auth(), owns: async () => true,
    }), /Unsupported/);
  }
});
