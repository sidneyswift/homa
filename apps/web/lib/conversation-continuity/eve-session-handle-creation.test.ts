import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { observeEveRouteCreation, protectEveSessionHandleCreation } from "./eve-session-handle-creation";
import type { EveSessionBindingClaim, EveSessionOwner, EveSessionOwnerStore } from "./eve-session-owners";
import type { EveSessionRouteAuthResult } from "./eve-session-route-auth";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const EPISODE = "33333333-3333-4333-8333-333333333333";
const SESSION = "new-session";
const auth = () => ({
  authenticator: "app", principalType: "user" as const, principalId: MEMBER,
  attributes: {
    familyId: FAMILY, memberUserId: MEMBER, channel: "web",
    episodeId: EPISODE,
    continuityThreadHash: createHash("sha256").update(`web:${MEMBER}`).digest("hex"),
  },
});
function accepted(id = SESSION, header = id) {
  return Response.json({ ok: true, sessionId: id, status: "accepted" }, {
    status: 202, headers: { "x-eve-session-id": header, "cache-control": "no-store" },
  });
}
const request = () => new Request("https://homa.test/eve/v1/session", { method: "POST" });

function fixture() {
  const state = {
    steps: [] as string[], pending: null as null | { id: string; token: string },
    owners: new Map<string, EveSessionOwner>(), creatorAuth: auth() as unknown,
    verifiedAuth: auth() as EveSessionRouteAuthResult,
    provisionFails: false, activationFails: false, cancelFails: false,
    activationToken: "", binding: undefined as EveSessionBindingClaim | undefined,
    runtimeCalls: 0, nextId: 0,
    create: async () => ({ sessionId: SESSION, extra: "preserved" }),
  };
  const owners: Pick<EveSessionOwnerStore, "provision" | "activate" | "cancel" | "owns"> = {
    async provision(principal, token) {
      state.steps.push("provision");
      assert.deepEqual(principal, { familyId: FAMILY, memberUserId: MEMBER });
      if (state.provisionFails || state.pending) return null;
      state.pending = { id: `provision-${++state.nextId}`, token };
      return state.pending.id;
    },
    async activate(id, owner, token, continuationToken, binding) {
      state.steps.push("activate");
      assert.equal(id, state.pending?.id);
      assert.equal(token, state.pending?.token);
      assert.deepEqual(owner, { sessionId: SESSION, familyId: FAMILY, memberUserId: MEMBER });
      if (state.activationFails) return false;
      state.activationToken = continuationToken;
      state.binding = binding;
      state.owners.set(owner.sessionId, owner);
      state.pending = null;
      return true;
    },
    async cancel(id, principal, token) {
      state.steps.push("cancel-provision");
      assert.equal(id, state.pending?.id);
      assert.equal(token, state.pending?.token);
      assert.deepEqual(principal, { familyId: FAMILY, memberUserId: MEMBER });
      if (state.cancelFails) return false;
      state.pending = null;
      return true;
    },
    async owns(owner) {
      state.steps.push("owns");
      const existing = state.owners.get(owner.sessionId);
      return existing?.familyId === owner.familyId && existing.memberUserId === owner.memberUserId;
    },
  };
  const args = {
    marker: "context preserved",
    async __eveRouteSessionCreator() {
      state.steps.push("create"); state.runtimeCalls++;
      assert.equal(this.marker, "context preserved");
      return state.create();
    },
  };
  type Args = typeof args;
  const route = {
    method: "POST", path: "/eve/v1/session",
    async handler(_request: Request, context: Args) {
      const created = await (context.__eveRouteSessionCreator as (input: { auth: unknown }) => ReturnType<Args["__eveRouteSessionCreator"]>)({ auth: state.creatorAuth });
      assert.equal(created.extra, "preserved");
      state.steps.push("response");
      return accepted(created.sessionId);
    },
  };
  const protect = (handler = route.handler) => protectEveSessionHandleCreation({ ...route, handler }, {
    resolveAuth: async () => state.verifiedAuth, owners,
  });
  return { state, args, route, owners, protect };
}

test("ownership and continuity binding finish before an ID is returned", async () => {
  const f = fixture();
  const response = await f.protect().handler(request(), f.args);
  assert.equal(response.status, 202);
  assert.deepEqual(f.state.steps, ["provision", "create", "activate", "response"]);
  assert.deepEqual(f.state.binding, { episodeId: EPISODE, threadKeyHash: auth().attributes.continuityThreadHash });
  assert.equal(f.state.pending, null);
  assert.match(f.state.activationToken, /^eve-owner:/);
  assert.doesNotMatch(await response.text(), /eve-owner|eve-provision|continuationToken/);
});

test("provision failure starts no runtime work", async () => {
  const f = fixture(); f.state.provisionFails = true;
  assert.equal((await f.protect().handler(request(), f.args)).status, 503);
  assert.equal(f.state.runtimeCalls, 0);
});

test("missing creator context cancels the provision and exposes no ID", async () => {
  const f = fixture();
  const response = await f.protect().handler(request(), { marker: "context preserved" } as typeof f.args);
  assert.equal(response.status, 503);
  assert.deepEqual(f.state.steps, ["provision", "cancel-provision"]);
  assert.equal(f.state.pending, null);
  assert.equal(response.headers.get("x-eve-session-id"), null);
});

test("changed family, adult, channel, or missing continuity cannot reach creation", async () => {
  const invalid = [
    { ...auth(), principalId: "other-adult" },
    { ...auth(), attributes: { ...auth().attributes, familyId: "other-family" } },
    { ...auth(), attributes: { ...auth().attributes, memberUserId: "other-adult" } },
    { ...auth(), attributes: { ...auth().attributes, channel: "email" } },
    { ...auth(), attributes: { ...auth().attributes, episodeId: undefined } },
    { ...auth(), attributes: { ...auth().attributes, continuityThreadHash: undefined } },
    null,
  ];
  for (const principal of invalid) {
    const f = fixture(); f.state.creatorAuth = principal;
    assert.equal((await f.protect().handler(request(), f.args)).status, 503);
    assert.equal(f.state.runtimeCalls, 0);
    assert.equal(f.state.pending, null);
  }
});

test("activation refusal or exception hides an already-created runtime ID", async () => {
  for (const throws of [false, true]) {
    const f = fixture();
    if (throws) f.owners.activate = async () => { throw new Error("store unavailable"); };
    else f.state.activationFails = true;
    const response = await f.protect().handler(request(), f.args);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-eve-session-id"), null);
    assert.doesNotMatch(await response.text(), /new-session/);
    assert.equal(f.state.runtimeCalls, 1);
    assert.equal(f.state.owners.size, 0);
    assert.equal(f.state.pending, null);
  }
});

test("an upstream catch cannot disguise an authorization failure as success", async () => {
  const f = fixture(); f.state.activationFails = true;
  const guarded = f.protect(async (req, args) => {
    try { return await f.route.handler(req, args); } catch { return accepted(); }
  });
  assert.equal((await guarded.handler(request(), f.args)).status, 503);
  assert.equal(f.state.pending, null);
});

test("a changed response body, header, or status cannot advertise a different session", async () => {
  for (const result of [accepted("foreign-session"), accepted(SESSION, "foreign-session"), new Response("ok")]) {
    const f = fixture();
    const response = await f.protect(async (req, args) => { await f.route.handler(req, args); return result; }).handler(request(), f.args);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-eve-session-id"), null);
  }
});

test("an idempotent retry returns only an already-owned session and cancels its unused provision", async () => {
  for (const existing of ["same-owner", "foreign-family", "foreign-adult", "missing"]) {
    const f = fixture();
    if (existing !== "missing") f.state.owners.set(SESSION, {
      sessionId: SESSION, familyId: existing === "foreign-family" ? "other-family" : FAMILY,
      memberUserId: existing === "foreign-adult" ? "other-adult" : MEMBER,
    });
    const response = await f.protect(async () => accepted()).handler(request(), f.args);
    assert.equal(response.status, existing === "same-owner" ? 202 : 503);
    assert.equal(f.state.runtimeCalls, 0);
    assert.equal(f.state.pending, null);
    assert.deepEqual(f.state.steps, ["provision", "owns", "cancel-provision"]);
  }
});

test("an early body rejection preserves the rejection and releases the provision", async () => {
  const f = fixture();
  const response = await f.protect(async () => new Response("Invalid request", { status: 400 })).handler(request(), f.args);
  assert.equal(response.status, 400);
  assert.equal(f.state.runtimeCalls, 0);
  assert.equal(f.state.pending, null);
});

test("failed provision cleanup is reported as unavailable, never successful admission", async () => {
  const f = fixture(); f.state.cancelFails = true;
  f.state.owners.set(SESSION, { sessionId: SESSION, familyId: FAMILY, memberUserId: MEMBER });
  const response = await f.protect(async () => accepted()).handler(request(), f.args);
  assert.equal(response.status, 503);
  assert.notEqual(f.state.pending, null);
});

test("concurrent first creates admit only one runtime creation", async () => {
  const f = fixture();
  let entered!: () => void;
  let release!: () => void;
  const creationEntered = new Promise<void>((resolve) => { entered = resolve; });
  const mayFinish = new Promise<void>((resolve) => { release = resolve; });
  f.state.create = async () => { entered(); await mayFinish; return { sessionId: SESSION, extra: "preserved" }; };
  const first = f.protect().handler(request(), f.args);
  await creationEntered;
  const second = await f.protect().handler(request(), f.args);
  assert.equal(second.status, 503);
  release();
  assert.equal((await first).status, 202);
  assert.equal(f.state.runtimeCalls, 1);
});

test("a repeated creator invocation cannot create a second runtime", async () => {
  const f = fixture();
  const response = await f.protect(async (req, args) => {
    await f.route.handler(req, args);
    return f.route.handler(req, args);
  }).handler(request(), f.args);
  assert.equal(response.status, 503);
  assert.equal(f.state.runtimeCalls, 1);
});

test("the bridge refuses a changed internal creator contract", () => {
  assert.throws(() => observeEveRouteCreation({ __eveRouteSessionCreator: null }, async (_input, create) => create()));
});
