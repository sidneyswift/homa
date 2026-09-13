import assert from "node:assert/strict";
import test from "node:test";

import { eveSessionHandleOperationKeys, type SessionHandleRouteArgs } from "./eve-session-handle-authorization";
import { protectEveSessionHandleRoutes } from "./eve-session-handle-channel";

function fixture() {
  let touched = 0;
  const handler: (request: Request, args: SessionHandleRouteArgs) => Promise<Response> = async () => {
    touched++;
    return Response.json({ ok: true });
  };
  const routes = ["POST /eve/v1/session", ...eveSessionHandleOperationKeys()].map(key => {
    const [method, path] = key.split(" ");
    return { method, path, handler };
  });
  const health = { method: "GET", path: "/eve/v1/health", handler };
  return {
    channel: { routes: [...routes, health], marker: "preserved" }, health,
    deps: {
      resolveAuth: async () => new Response(null, { status: 404 }),
      owners: {
        provision: async () => { throw new Error("unexpected provision"); },
        activate: async () => false,
        cancel: async () => false,
        owns: async () => false,
      },
    },
    touched: () => touched,
  };
}

test("candidate composition guards all eight session routes and preserves other route definitions", async () => {
  const f = fixture();
  const guarded = protectEveSessionHandleRoutes(f.channel, f.deps);
  assert.equal(guarded.marker, "preserved");
  assert.equal(guarded.routes.at(-1), f.health);
  for (const route of guarded.routes.slice(0, -1)) {
    const response = await route.handler(new Request("https://homa.test"), {
      params: {}, attachSession: () => { throw new Error("unexpected runtime access"); },
    });
    assert.equal(response.status, 404);
  }
  assert.equal(f.touched(), 0);
});

test("candidate composition rejects each missing or duplicated session operation", () => {
  const f = fixture();
  for (const route of f.channel.routes.slice(0, -1)) {
    assert.throws(() => protectEveSessionHandleRoutes({ routes: f.channel.routes.filter(r => r !== route) }, f.deps), /found 0/);
    assert.throws(() => protectEveSessionHandleRoutes({ routes: [...f.channel.routes, route] }, f.deps), /found 2/);
  }
  assert.equal(f.touched(), 0);
});

test("candidate composition refuses unknown session methods, paths, and WebSocket routes", () => {
  const f = fixture();
  for (const route of [
    { method: "DELETE", path: "/eve/v1/session/:sessionId", handler: f.health.handler },
    { method: "POST", path: "/eve/v1/session/:sessionId/export", handler: f.health.handler },
    { transport: "websocket" as const, path: "/eve/v1/session/:sessionId/stream" },
  ]) {
    assert.throws(() => protectEveSessionHandleRoutes({ routes: [...f.channel.routes, route] }, f.deps), /unexpected/);
  }
});
