import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defineChannel,
  GET,
  type HttpRouteDefinition,
  POST,
  type RouteHandlerArgs,
  WS,
} from "eve-legacy-protocol/channels";
import { eveChannel } from "eve-legacy-protocol/channels/eve";

import { readEveMembership } from "../eve-membership";
import {
  createCachedRouteAuth,
  protectEveSessionRoutes,
} from "./eve-session-channel";
import type {
  EveSessionBindingClaim,
  EveSessionOwner,
  EveSessionOwnerStore,
} from "./eve-session-owners";
import { webSessionThreadHash } from "./web-session-binding";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const EPISODE_ID = "22222222-2222-4222-8222-222222222222";

function authFor(request: Request) {
  const userId = request.headers.get("x-user") ?? "adult-a";
  return Promise.resolve({
    authenticator: "app",
    principalId: userId,
    principalType: "user" as const,
    attributes: {
      channel: "web",
      continuityThreadHash: webSessionThreadHash(userId),
      episodeId: EPISODE_ID,
      familyId: FAMILY_ID,
      memberUserId: userId,
    },
  });
}

type StoredOwner = EveSessionOwner & {
  continuationToken: string;
  reservationToken: string | null;
};

function inMemoryOwners(): EveSessionOwnerStore {
  const owners = new Map<string, StoredOwner>();
  const provisions = new Map<
    string,
    {
      binding: EveSessionBindingClaim | undefined;
      continuationToken: string;
      familyId: string;
      memberUserId: string;
    }
  >();
  let nextProvisionId = 1;
  return {
    async provision(principal, continuationToken, binding) {
      if (
        [...provisions.values()].some(
          (provision) =>
            provision.familyId === principal.familyId &&
            provision.memberUserId === principal.memberUserId,
        )
      ) {
        return null;
      }
      const provisionId = `provision-${nextProvisionId}`;
      nextProvisionId += 1;
      provisions.set(provisionId, {
        ...principal,
        binding,
        continuationToken,
      });
      return provisionId;
    },
    async activate(
      provisionId,
      owner,
      provisionalToken,
      continuationToken,
      binding,
    ) {
      const provision = provisions.get(provisionId);
      if (
        !provision ||
        provision.familyId !== owner.familyId ||
        provision.memberUserId !== owner.memberUserId ||
        provision.continuationToken !== provisionalToken ||
        (provision.binding !== undefined &&
          (provision.binding.episodeId !== binding?.episodeId ||
            provision.binding.threadKeyHash !== binding?.threadKeyHash)) ||
        owners.has(owner.sessionId)
      ) {
        return false;
      }
      provisions.delete(provisionId);
      owners.set(owner.sessionId, {
        ...owner,
        continuationToken,
        reservationToken: null,
      });
      return true;
    },
    async cancel(provisionId, principal, provisionalToken) {
      const provision = provisions.get(provisionId);
      if (
        !provision ||
        provision.familyId !== principal.familyId ||
        provision.memberUserId !== principal.memberUserId ||
        provision.continuationToken !== provisionalToken
      ) {
        return false;
      }
      provisions.delete(provisionId);
      return true;
    },
    async owns(owner) {
      const current = owners.get(owner.sessionId);
      return (
        current?.familyId === owner.familyId &&
        current.memberUserId === owner.memberUserId
      );
    },
    async reserveContinuation(owner, currentToken, reservationToken) {
      const current = owners.get(owner.sessionId);
      if (
        current?.familyId !== owner.familyId ||
        current.memberUserId !== owner.memberUserId ||
        current.continuationToken !== currentToken ||
        current.reservationToken !== null
      ) {
        return false;
      }
      owners.set(owner.sessionId, { ...current, reservationToken });
      return true;
    },
    async completeContinuation(owner, reservationToken, nextToken) {
      const current = owners.get(owner.sessionId);
      if (
        current?.familyId !== owner.familyId ||
        current.memberUserId !== owner.memberUserId ||
        current.reservationToken !== reservationToken
      ) {
        return false;
      }
      owners.set(owner.sessionId, {
        ...current,
        continuationToken: nextToken,
        reservationToken: null,
      });
      return true;
    },
    async restoreContinuation(owner, reservationToken) {
      const current = owners.get(owner.sessionId);
      if (
        current?.familyId !== owner.familyId ||
        current.memberUserId !== owner.memberUserId ||
        current.reservationToken !== reservationToken
      ) {
        return false;
      }
      owners.set(owner.sessionId, { ...current, reservationToken: null });
      return true;
    },
    async revokeContinuation(owner, reservationToken) {
      const current = owners.get(owner.sessionId);
      if (
        current?.familyId !== owner.familyId ||
        current.memberUserId !== owner.memberUserId ||
        current.reservationToken !== reservationToken
      ) {
        return false;
      }
      owners.delete(owner.sessionId);
      return true;
    },
  };
}

function sessionFixture(
  id: string,
  continuationToken = `eve:${id}`,
  eventText = "private-event-a",
) {
  return {
    id,
    continuationToken,
    async getEventStream() {
      return new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: "message.completed",
            data: { message: eventText },
          });
          controller.close();
        },
      });
    },
  };
}

function routeArgs(
  sessionId?: string,
  overrides: Partial<Pick<RouteHandlerArgs, "send" | "getSession">> = {},
): RouteHandlerArgs {
  return {
    params: sessionId ? { sessionId } : {},
    send:
      overrides.send ??
      (async () => {
        throw new Error("unused send");
      }),
    getSession:
      overrides.getSession ??
      (() => {
        throw new Error("unused getSession");
      }),
    receive: async () => {
      throw new Error("unused receive");
    },
    waitUntil: () => undefined,
    requestIp: null,
  };
}

function handler(
  channel: ReturnType<typeof defineChannel>,
  method: string,
  path: string,
) {
  const route = channel.routes.find(
    (candidate) =>
      candidate.transport !== "websocket" &&
      candidate.method === method &&
      candidate.path === path,
  ) as HttpRouteDefinition | undefined;
  assert.ok(route);
  return route.handler;
}

function request(
  path: string,
  user: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(`https://homa.test${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      "x-user": user,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function createOwnedSession(input: {
  channel: ReturnType<typeof defineChannel>;
  sessionId: string;
  user: string;
}): Promise<Response> {
  return await handler(
    input.channel,
    "POST",
    "/eve/v1/session",
  )(
    request("/eve/v1/session", input.user, { message: "Hello Homa" }),
    routeArgs(undefined, {
      send: async () => sessionFixture(input.sessionId),
    }),
  );
}

// This suite protects the retained token protocol with its exact SDK. Handle
// authorization has its own suite; an active SDK upgrade must not reinterpret
// these token fixtures as handle requests or silently skip their checks.
describe("Eve 0.19 token-protocol exact-adult session authorization", () => {
  it("returns membership outages before any ownership or runtime access on every protected route", async (t) => {
    t.mock.method(console, "info", () => {});
    let ownerCalls = 0;
    let runtimeCalls = 0;
    let fallbackCalls = 0;
    const unavailableOwner = async () => {
      ownerCalls += 1;
      throw new Error("ownership must not run");
    };
    const cachedAuth = createCachedRouteAuth([
      async () => {
        await readEveMembership(async () => ({
          data: null, error: { message: "Gateway Timeout" }, status: 504,
        }));
        return null;
      },
      () => { fallbackCalls += 1; return null; },
    ]);
    const channel = protectEveSessionRoutes(eveChannel({ auth: cachedAuth.auth }), {
      resolveAuth: cachedAuth.resolve,
      owners: {
        ...inMemoryOwners(),
        provision: unavailableOwner,
        reserveContinuation: unavailableOwner,
        owns: unavailableOwner,
      },
    });
    for (const [method, pattern, path, body] of [
      ["POST", "/eve/v1/session", "/eve/v1/session", { message: "Hello Homa" }],
      ["POST", "/eve/v1/session/:sessionId", "/eve/v1/session/session-a", { message: "Hello Homa", continuationToken: "eve:session-a" }],
      ["GET", "/eve/v1/session/:sessionId/stream", "/eve/v1/session/session-a/stream", undefined],
    ] as const) {
      const response = await handler(channel, method, pattern)(
        request(path, "adult-a", body),
        routeArgs("session-a", {
          send: async () => { runtimeCalls += 1; return sessionFixture("session-a"); },
          getSession: () => { runtimeCalls += 1; return sessionFixture("session-a"); },
        }),
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("retry-after"), "1");
      assert.equal((await response.json()).code, "auth_service_unavailable");
    }
    assert.equal(ownerCalls, 0);
    assert.equal(runtimeCalls, 0);
    assert.equal(fallbackCalls, 0);
  });

  it("keeps invalid credentials and missing family membership denied before ownership", async () => {
    let ownerCalls = 0;
    for (const [expectedStatus, resolve] of [
      [401, async () => null],
      [404, async () => ({
        authenticator: "app", principalId: "adult-a", principalType: "user" as const,
        attributes: { memberUserId: "adult-a" },
      })],
    ] as const) {
      const cachedAuth = createCachedRouteAuth(resolve);
      const channel = protectEveSessionRoutes(eveChannel({ auth: cachedAuth.auth }), {
        resolveAuth: cachedAuth.resolve,
        owners: {
          ...inMemoryOwners(),
          async provision() { ownerCalls += 1; return null; },
        },
      });
      const response = await handler(channel, "POST", "/eve/v1/session")(
        request("/eve/v1/session", "adult-a", { message: "Hello Homa" }),
        routeArgs(),
      );
      assert.equal(response.status, expectedStatus);
    }
    assert.equal(ownerCalls, 0);
  });

  it("rechecks membership on a fresh retry and preserves the rejected continuation token", async (t) => {
    t.mock.method(console, "info", () => {});
    let unavailable = false;
    let authCalls = 0;
    let reserveCalls = 0;
    let sends = 0;
    const cachedAuth = createCachedRouteAuth(async (incoming) => {
      authCalls += 1;
      await readEveMembership(async () => ({
        data: null,
        error: unavailable ? { message: "Gateway Timeout" } : null,
        status: unavailable ? 504 : 200,
      }));
      return await authFor(incoming);
    });
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(eveChannel({ auth: cachedAuth.auth }), {
      resolveAuth: cachedAuth.resolve,
      owners: {
        ...owners,
        async reserveContinuation(...args) {
          reserveCalls += 1;
          return await owners.reserveContinuation(...args);
        },
      },
    });
    assert.equal((await createOwnedSession({ channel, sessionId: "session-a", user: "adult-a" })).status, 202);
    const continueOnce = () => handler(channel, "POST", "/eve/v1/session/:sessionId")(
      request("/eve/v1/session/session-a", "adult-a", {
        continuationToken: "eve:session-a", message: "Retry these exact words",
      }),
      routeArgs("session-a", {
        getSession: () => sessionFixture("session-a"),
        send: async () => {
          sends += 1;
          return sessionFixture("session-a", "eve:session-a");
        },
      }),
    );
    unavailable = true;
    assert.equal((await continueOnce()).status, 503);
    assert.equal(reserveCalls, 0);
    assert.equal(sends, 0);
    unavailable = false;
    assert.equal((await continueOnce()).status, 200);
    assert.equal(reserveCalls, 1);
    assert.equal(sends, 1);
    assert.equal(authCalls, 3, "each request rechecks once, including the retry");
  });

  it("provisions before work and activates the exact adult before returning", async () => {
    let authCalls = 0;
    let ownerProvisioned = false;
    let ownerActivated = false;
    let onMessageSawProvision = false;
    let sendSawProvision = false;
    let bindingClaim: EveSessionBindingClaim | undefined;
    const cachedAuth = createCachedRouteAuth(async (incoming) => {
      authCalls += 1;
      return await authFor(incoming);
    });
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(
      eveChannel({
        auth: cachedAuth.auth,
        async onMessage(ctx) {
          onMessageSawProvision = ownerProvisioned;
          return { auth: ctx.eve.caller };
        },
      }),
      {
        resolveAuth: cachedAuth.resolve,
        owners: {
          ...owners,
          async provision(principal, continuationToken, binding) {
            const provisionId = await owners.provision(
              principal,
              continuationToken,
              binding,
            );
            ownerProvisioned = provisionId !== null;
            return provisionId;
          },
          async activate(...args) {
            bindingClaim = args[4];
            ownerActivated = await owners.activate(...args);
            return ownerActivated;
          },
        },
      },
    );

    const response = await handler(
      channel,
      "POST",
      "/eve/v1/session",
    )(
      request("/eve/v1/session", "adult-a", { message: "Hello Homa" }),
      routeArgs(undefined, {
        send: async () => {
          sendSawProvision = ownerProvisioned;
          return sessionFixture("session-a");
        },
      }),
    );

    assert.equal(response.status, 202);
    assert.equal(response.headers.get("x-eve-session-id"), "session-a");
    assert.equal(ownerProvisioned, true);
    assert.equal(onMessageSawProvision, true);
    assert.equal(sendSawProvision, true);
    assert.equal(ownerActivated, true);
    assert.deepEqual(bindingClaim, {
      episodeId: EPISODE_ID,
      threadKeyHash: webSessionThreadHash("adult-a"),
    });
    assert.equal(authCalls, 1);
  });

  it("lets only one simultaneous first create reach the runtime", async () => {
    let onMessages = 0;
    const channel = protectEveSessionRoutes(
      eveChannel({
        auth: authFor,
        async onMessage(ctx) {
          onMessages += 1;
          return { auth: ctx.eve.caller };
        },
      }),
      {
        resolveAuth: authFor,
        owners: inMemoryOwners(),
      },
    );
    const createSession = handler(channel, "POST", "/eve/v1/session");
    let releaseSend!: () => void;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    let markSendEntered!: () => void;
    const sendEntered = new Promise<void>((resolve) => {
      markSendEntered = resolve;
    });
    let sends = 0;
    const createArgs = () =>
      routeArgs(undefined, {
        send: async () => {
          sends += 1;
          markSendEntered();
          await sendGate;
          return sessionFixture("session-a");
        },
      });
    const createRequest = () =>
      request("/eve/v1/session", "adult-a", { message: "Hello Homa" });

    const first = createSession(createRequest(), createArgs());
    await sendEntered;
    const second = await createSession(createRequest(), createArgs());

    assert.equal(second.status, 503);
    assert.equal(sends, 1);
    assert.equal(onMessages, 1);
    releaseSend();
    assert.equal((await first).status, 202);
  });

  it("cancels a pre-provision when Eve returns before send", async () => {
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners: inMemoryOwners(),
    });
    const createSession = handler(channel, "POST", "/eve/v1/session");
    const invalid = await createSession(
      request("/eve/v1/session", "adult-a", {}),
      routeArgs(),
    );
    assert.equal(invalid.status, 400);

    const valid = await createOwnedSession({
      channel,
      sessionId: "session-after-invalid",
      user: "adult-a",
    });
    assert.equal(valid.status, 202);
  });

  it("denies unknown, legacy, and other-adult sessions before runtime lookup", async () => {
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners,
    });
    assert.equal(
      (
        await createOwnedSession({
          channel,
          sessionId: "session-a",
          user: "adult-a",
        })
      ).status,
      202,
    );
    let runtimeLookups = 0;
    let sends = 0;
    const getSession = () => {
      runtimeLookups += 1;
      return sessionFixture("session-a");
    };
    const send = async () => {
      sends += 1;
      return sessionFixture("session-a", "eve:session-a-next");
    };
    const stream = handler(channel, "GET", "/eve/v1/session/:sessionId/stream");
    const continueSession = handler(
      channel,
      "POST",
      "/eve/v1/session/:sessionId",
    );

    for (const [sessionId, user] of [
      ["session-a", "adult-b"],
      ["legacy-session", "adult-a"],
      ["unknown-session", "adult-a"],
    ] as const) {
      const streamed = await stream(
        request(`/eve/v1/session/${sessionId}/stream`, user),
        routeArgs(sessionId, { getSession }),
      );
      assert.equal(streamed.status, 404);
      assert.equal(streamed.headers.get("cache-control"), "no-store");

      const continued = await continueSession(
        request(`/eve/v1/session/${sessionId}`, user, {
          continuationToken: "eve:session-a",
          message: "Try to continue it",
        }),
        routeArgs(sessionId, { getSession, send }),
      );
      assert.equal(continued.status, 404);
    }

    assert.equal(runtimeLookups, 0);
    assert.equal(sends, 0);
  });

  it("rejects one adult's token on another adult's valid session path", async () => {
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners,
    });
    for (const [sessionId, user] of [
      ["session-a", "adult-a"],
      ["session-b", "adult-b"],
    ] as const) {
      assert.equal(
        (await createOwnedSession({ channel, sessionId, user })).status,
        202,
      );
    }
    let runtimeLookups = 0;
    let sends = 0;

    const response = await handler(
      channel,
      "POST",
      "/eve/v1/session/:sessionId",
    )(
      request("/eve/v1/session/session-b", "adult-b", {
        continuationToken: "eve:session-a",
        message: "Use A's token on B's path",
      }),
      routeArgs("session-b", {
        getSession: () => {
          runtimeLookups += 1;
          return sessionFixture("session-b");
        },
        send: async () => {
          sends += 1;
          return sessionFixture("session-b");
        },
      }),
    );

    assert.equal(response.status, 404);
    assert.equal(runtimeLookups, 0);
    assert.equal(sends, 0);
  });

  it("lets only one simultaneous continuation consume a token", async () => {
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners,
    });
    assert.equal(
      (
        await createOwnedSession({
          channel,
          sessionId: "session-a",
          user: "adult-a",
        })
      ).status,
      202,
    );

    let releaseSend!: () => void;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    let markSendEntered!: () => void;
    const sendEntered = new Promise<void>((resolve) => {
      markSendEntered = resolve;
    });
    let sends = 0;
    let runtimeLookups = 0;
    const continueSession = handler(
      channel,
      "POST",
      "/eve/v1/session/:sessionId",
    );
    const continuationRequest = () =>
      request("/eve/v1/session/session-a", "adult-a", {
        continuationToken: "eve:session-a",
        message: "One turn only",
      });
    const continuationArgs = () =>
      routeArgs("session-a", {
        getSession: () => {
          runtimeLookups += 1;
          return sessionFixture("session-a");
        },
        send: async () => {
          sends += 1;
          markSendEntered();
          await sendGate;
          return sessionFixture("session-a", "eve:session-a");
        },
      });

    const first = continueSession(continuationRequest(), continuationArgs());
    await sendEntered;
    const second = await continueSession(
      continuationRequest(),
      continuationArgs(),
    );

    assert.equal(second.status, 404);
    releaseSend();
    assert.equal((await first).status, 200);
    assert.equal(runtimeLookups, 1);
    assert.equal(sends, 1);

    const afterCompletion = await continueSession(
      continuationRequest(),
      routeArgs("session-a", {
        getSession: () => {
          runtimeLookups += 1;
          return sessionFixture("session-a");
        },
        send: async () => {
          sends += 1;
          return sessionFixture("session-a", "eve:session-a");
        },
      }),
    );
    assert.equal(afterCompletion.status, 200);
    assert.equal(runtimeLookups, 2);
    assert.equal(sends, 2);
  });

  it("restores a reservation when Eve rejects before sending", async () => {
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners,
    });
    assert.equal(
      (
        await createOwnedSession({
          channel,
          sessionId: "session-a",
          user: "adult-a",
        })
      ).status,
      202,
    );
    const continueSession = handler(
      channel,
      "POST",
      "/eve/v1/session/:sessionId",
    );
    const invalid = await continueSession(
      request("/eve/v1/session/session-a", "adult-a", {
        continuationToken: "eve:session-a",
      }),
      routeArgs("session-a", {
        getSession: () => sessionFixture("session-a"),
      }),
    );
    assert.equal(invalid.status, 400);

    const valid = await continueSession(
      request("/eve/v1/session/session-a", "adult-a", {
        continuationToken: "eve:session-a",
        message: "Now continue",
      }),
      routeArgs("session-a", {
        getSession: () => sessionFixture("session-a"),
        send: async () => sessionFixture("session-a", "eve:session-a"),
      }),
    );
    assert.equal(valid.status, 200);
  });

  it("revokes an ambiguous post-send session", async () => {
    const baseOwners = inMemoryOwners();
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners: {
        ...baseOwners,
        async completeContinuation() {
          return false;
        },
      },
    });
    assert.equal(
      (
        await createOwnedSession({
          channel,
          sessionId: "session-a",
          user: "adult-a",
        })
      ).status,
      202,
    );
    const continueSession = handler(
      channel,
      "POST",
      "/eve/v1/session/:sessionId",
    );
    let sends = 0;
    const continueOnce = () =>
      continueSession(
        request("/eve/v1/session/session-a", "adult-a", {
          continuationToken: "eve:session-a",
          message: "Continue safely",
        }),
        routeArgs("session-a", {
          getSession: () => sessionFixture("session-a"),
          send: async () => {
            sends += 1;
            return sessionFixture("session-a", "eve:session-a");
          },
        }),
      );

    assert.equal((await continueOnce()).status, 503);
    assert.equal((await continueOnce()).status, 404);
    assert.equal(sends, 1);
  });

  it("never starts work or reveals an id when provisioning fails", async () => {
    const baseOwners = inMemoryOwners();
    for (const provision of [
      async () => null,
      async () => {
        throw new Error("owner store unavailable");
      },
    ]) {
      const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
        resolveAuth: authFor,
        owners: { ...baseOwners, provision },
      });
      let sends = 0;
      const response = await handler(
        channel,
        "POST",
        "/eve/v1/session",
      )(
        request("/eve/v1/session", "adult-a", { message: "Hello Homa" }),
        routeArgs(undefined, {
          send: async () => {
            sends += 1;
            return sessionFixture("unowned-session");
          },
        }),
      );
      assert.equal(response.status, 503);
      assert.equal(sends, 0);
      assert.equal(response.headers.get("x-eve-session-id"), null);
      assert.doesNotMatch(await response.text(), /unowned-session/u);
    }
  });

  it("never reveals an id when activation fails after runtime creation", async () => {
    for (const activate of [
      async () => false,
      async () => {
        throw new Error("owner activation unavailable");
      },
    ]) {
      const owners = inMemoryOwners();
      const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
        resolveAuth: authFor,
        owners: { ...owners, activate },
      });
      const response = await createOwnedSession({
        channel,
        sessionId: "unowned-session",
        user: "adult-a",
      });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("x-eve-session-id"), null);
      assert.doesNotMatch(await response.text(), /unowned-session/u);
    }
  });

  it("fails closed when membership disappears between provision and activation", async () => {
    const owners = inMemoryOwners();
    let provisioned = false;
    const channel = protectEveSessionRoutes(eveChannel({ auth: authFor }), {
      resolveAuth: authFor,
      owners: {
        ...owners,
        async provision(...args) {
          const result = await owners.provision(...args);
          provisioned = result !== null;
          return result;
        },
        async activate() {
          assert.equal(provisioned, true);
          return false;
        },
      },
    });

    const response = await createOwnedSession({
      channel,
      sessionId: "removed-member-session",
      user: "adult-a",
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-eve-session-id"), null);
    assert.doesNotMatch(await response.text(), /removed-member-session/u);
  });

  it("hides create and continue response bodies that disagree with send", async () => {
    const owners = inMemoryOwners();
    const base = eveChannel({ auth: authFor });
    const mismatched = {
      ...base,
      routes: base.routes.map((route) => {
        if (
          route.transport === "websocket" ||
          (route.path !== "/eve/v1/session" &&
            route.path !== "/eve/v1/session/:sessionId")
        ) {
          return route;
        }
        const original = route.handler;
        return {
          ...route,
          handler: async (incoming: Request, args: RouteHandlerArgs) => {
            const response = await original(incoming, args);
            if (response.status !== 202 && response.status !== 200) {
              return response;
            }
            const body = (await response.json()) as Record<string, unknown>;
            return Response.json(
              { ...body, sessionId: "mismatched-session" },
              { headers: response.headers, status: response.status },
            );
          },
        };
      }),
    } as typeof base;
    const channel = protectEveSessionRoutes(mismatched, {
      resolveAuth: authFor,
      owners,
    });

    const createResponse = await createOwnedSession({
      channel,
      sessionId: "session-hidden",
      user: "adult-a",
    });
    assert.equal(createResponse.status, 503);
    assert.doesNotMatch(await createResponse.text(), /session-hidden/u);

    const continuedBase = {
      ...base,
      routes: base.routes.map((route) => {
        if (
          route.transport === "websocket" ||
          route.path !== "/eve/v1/session/:sessionId"
        ) {
          return route;
        }
        const original = route.handler;
        return {
          ...route,
          handler: async (incoming: Request, args: RouteHandlerArgs) => {
            const response = await original(incoming, args);
            if (response.status !== 200) return response;
            return Response.json(
              { ok: true, sessionId: "mismatched-session" },
              { headers: response.headers, status: 200 },
            );
          },
        };
      }),
    } as typeof base;
    const continueOwners = inMemoryOwners();
    const continued = protectEveSessionRoutes(continuedBase, {
      resolveAuth: authFor,
      owners: continueOwners,
    });
    assert.equal(
      (
        await createOwnedSession({
          channel: continued,
          sessionId: "session-a",
          user: "adult-a",
        })
      ).status,
      202,
    );
    const continuedResponse = await handler(
      continued,
      "POST",
      "/eve/v1/session/:sessionId",
    )(
      request("/eve/v1/session/session-a", "adult-a", {
        continuationToken: "eve:session-a",
        message: "Continue",
      }),
      routeArgs("session-a", {
        getSession: () => sessionFixture("session-a"),
        send: async () => sessionFixture("session-a", "eve:session-a"),
      }),
    );
    assert.equal(continuedResponse.status, 503);
    assert.doesNotMatch(await continuedResponse.text(), /mismatched-session/u);
    let retrySends = 0;
    const retry = await handler(
      continued,
      "POST",
      "/eve/v1/session/:sessionId",
    )(
      request("/eve/v1/session/session-a", "adult-a", {
        continuationToken: "eve:session-a",
        message: "Retry",
      }),
      routeArgs("session-a", {
        getSession: () => sessionFixture("session-a"),
        send: async () => {
          retrySends += 1;
          return sessionFixture("session-a", "eve:session-a");
        },
      }),
    );
    assert.equal(retry.status, 404);
    assert.equal(retrySends, 0);
  });

  it("refuses a normal app create before work when continuity binding is missing", async () => {
    const unboundAuth = async (incoming: Request) => {
      const auth = await authFor(incoming);
      return {
        ...auth,
        attributes: {
          channel: "web",
          familyId: auth.attributes.familyId,
          memberUserId: auth.attributes.memberUserId,
        },
      };
    };
    const channel = protectEveSessionRoutes(eveChannel({ auth: unboundAuth }), {
      resolveAuth: unboundAuth,
      owners: inMemoryOwners(),
    });
    let sends = 0;
    const response = await handler(
      channel,
      "POST",
      "/eve/v1/session",
    )(
      request("/eve/v1/session", "adult-a", { message: "Hello Homa" }),
      routeArgs(undefined, {
        send: async () => {
          sends += 1;
          return sessionFixture("unbound-session");
        },
      }),
    );

    assert.equal(response.status, 503);
    assert.equal(sends, 0);
    assert.doesNotMatch(await response.text(), /unbound-session/u);
  });

  it("allows only current-environment Vercel runtime auth to bypass ownership", async () => {
    let streamCalls = 0;
    const base = defineChannel({
      routes: [
        POST(
          "/eve/v1/session",
          async () => new Response(null, { status: 202 }),
        ),
        POST("/eve/v1/session/:sessionId", async () => new Response(null)),
        GET("/eve/v1/session/:sessionId/stream", async () => {
          streamCalls += 1;
          return new Response("operator stream");
        }),
      ],
    });
    const streamRequest = new Request(
      "https://homa.test/eve/v1/session/operator-session/stream",
    );
    const streamArgs = routeArgs("operator-session");
    const unknown = protectEveSessionRoutes(base, {
      resolveAuth: async () => ({
        authenticator: "future-auth",
        principalId: "future-principal",
        principalType: "service",
        attributes: {},
      }),
      owners: inMemoryOwners(),
    });
    assert.equal(
      (
        await handler(
          unknown,
          "GET",
          "/eve/v1/session/:sessionId/stream",
        )(streamRequest, streamArgs)
      ).status,
      404,
    );
    assert.equal(streamCalls, 0);

    const service = protectEveSessionRoutes(base, {
      resolveAuth: async () => ({
        authenticator: "oidc",
        principalId: "vercel-service",
        principalType: "service",
        issuer: "https://oidc.vercel.com/example",
        attributes: {},
      }),
      owners: inMemoryOwners(),
    });
    const serviceResponse = await handler(
      service,
      "GET",
      "/eve/v1/session/:sessionId/stream",
    )(streamRequest, streamArgs);
    assert.equal(serviceResponse.status, 404);
    assert.equal(streamCalls, 0);

    const oidcUser = protectEveSessionRoutes(base, {
      resolveAuth: async () => ({
        authenticator: "oidc",
        principalId: "vercel-user",
        principalType: "user",
        issuer: "https://oidc.vercel.com/example",
        attributes: {},
      }),
      owners: inMemoryOwners(),
    });
    assert.equal(
      (
        await handler(
          oidcUser,
          "GET",
          "/eve/v1/session/:sessionId/stream",
        )(streamRequest, streamArgs)
      ).status,
      404,
    );
    assert.equal(streamCalls, 0);

    const runtime = protectEveSessionRoutes(base, {
      resolveAuth: async () => ({
        authenticator: "oidc",
        principalId: "vercel-runtime",
        principalType: "runtime",
        issuer: "https://oidc.vercel.com/example",
        attributes: {},
      }),
      owners: inMemoryOwners(),
    });
    const runtimeResponse = await handler(
      runtime,
      "GET",
      "/eve/v1/session/:sessionId/stream",
    )(streamRequest, streamArgs);
    assert.equal(runtimeResponse.status, 200);
    assert.equal(await runtimeResponse.text(), "operator stream");
    assert.equal(streamCalls, 1);
  });

  it("rejects app auth whose principal does not match its adult attribute", async () => {
    let streamCalls = 0;
    let ownerReads = 0;
    const base = defineChannel({
      routes: [
        POST(
          "/eve/v1/session",
          async () => new Response(null, { status: 202 }),
        ),
        POST("/eve/v1/session/:sessionId", async () => new Response(null)),
        GET("/eve/v1/session/:sessionId/stream", async () => {
          streamCalls += 1;
          return new Response("private stream");
        }),
      ],
    });
    const owners = inMemoryOwners();
    const channel = protectEveSessionRoutes(base, {
      resolveAuth: async () => ({
        authenticator: "app",
        principalId: "adult-b",
        principalType: "user",
        attributes: {
          familyId: FAMILY_ID,
          memberUserId: "adult-a",
        },
      }),
      owners: {
        ...owners,
        async owns(owner) {
          ownerReads += 1;
          return await owners.owns(owner);
        },
      },
    });

    const response = await handler(
      channel,
      "GET",
      "/eve/v1/session/:sessionId/stream",
    )(
      new Request("https://homa.test/eve/v1/session/session-a/stream"),
      routeArgs("session-a"),
    );

    assert.equal(response.status, 404);
    assert.equal(ownerReads, 0);
    assert.equal(streamCalls, 0);
  });

  it("fails fast when Eve changes the protected route contract", () => {
    const incomplete = defineChannel({
      routes: [
        POST("/eve/v1/session", async () => new Response(null)),
        POST("/eve/v1/session/:sessionId", async () => new Response(null)),
      ],
    });
    assert.throws(
      () =>
        protectEveSessionRoutes(incomplete, {
          resolveAuth: authFor,
          owners: inMemoryOwners(),
        }),
      /Eve session route contract changed/u,
    );
  });

  it("fails fast when Eve adds an unwrapped session route", () => {
    const expanded = defineChannel({
      routes: [
        POST("/eve/v1/session", async () => new Response(null)),
        POST("/eve/v1/session/:sessionId", async () => new Response(null)),
        GET(
          "/eve/v1/session/:sessionId/stream",
          async () => new Response(null),
        ),
        GET(
          "/eve/v1/session/:sessionId/export",
          async () => new Response(null),
        ),
      ],
    });
    assert.throws(
      () =>
        protectEveSessionRoutes(expanded, {
          resolveAuth: authFor,
          owners: inMemoryOwners(),
        }),
      /unexpected GET \/eve\/v1\/session\/:sessionId\/export/u,
    );
  });

  it("fails fast when Eve adds a session WebSocket route", () => {
    const expanded = defineChannel({
      routes: [
        POST("/eve/v1/session", async () => new Response(null)),
        POST("/eve/v1/session/:sessionId", async () => new Response(null)),
        GET(
          "/eve/v1/session/:sessionId/stream",
          async () => new Response(null),
        ),
        WS("/eve/v1/session/:sessionId/socket", () => ({})),
      ],
    });
    assert.throws(
      () =>
        protectEveSessionRoutes(expanded, {
          resolveAuth: authFor,
          owners: inMemoryOwners(),
        }),
      /unexpected WEBSOCKET \/eve\/v1\/session\/:sessionId\/socket/u,
    );
  });
});
