import { randomUUID } from "node:crypto";

import type {
  Channel,
  HttpRouteDefinition,
  RouteDefinition,
  RouteHandlerArgs,
} from "eve/channels";
import { routeAuth, type AuthFn } from "eve/channels/auth";

import type {
  EveSessionBindingClaim,
  EveSessionOwner,
  EveSessionOwnerStore,
  EveSessionPrincipal,
} from "./eve-session-owners";

const CREATE_PATH = "/eve/v1/session";
const CONTINUE_PATH = "/eve/v1/session/:sessionId";
const STREAM_PATH = "/eve/v1/session/:sessionId/stream";
const SESSION_ID_HEADER = "x-eve-session-id";
const MAX_CONTINUATION_TOKEN_LENGTH = 8_000;

class EveSessionAuthorizationError extends Error {
  constructor() {
    super("Eve session authorization failed.");
    this.name = "EveSessionAuthorizationError";
  }
}

type RouteAuthResult = Awaited<ReturnType<typeof routeAuth>>;

export interface CachedRouteAuth {
  auth: readonly AuthFn<Request>[];
  resolve(request: Request): Promise<RouteAuthResult>;
}

/**
 * Eve's original handler and the ownership wrapper both authenticate the same
 * Request. Cache each auth strategy separately so both walks share the result
 * without changing the walk's error response or fallback semantics.
 */
export function createCachedRouteAuth(
  auth: AuthFn<Request> | readonly AuthFn<Request>[],
): CachedRouteAuth {
  const entries = Array.isArray(auth) ? [...auth] : [auth as AuthFn<Request>];
  const cachedEntries = entries.map((entry): AuthFn<Request> => {
    const cache = new WeakMap<
      Request,
      Promise<Awaited<ReturnType<AuthFn<Request>>>>
    >();
    return (request) => {
      const current = cache.get(request);
      if (current) return current;
      const pending = Promise.resolve(entry(request));
      cache.set(request, pending);
      return pending;
    };
  });
  return {
    auth: cachedEntries,
    resolve: async (request) => await routeAuth(request, cachedEntries),
  };
}

type Caller =
  | { kind: "app"; familyId: string; memberUserId: string }
  | { kind: "privileged" };

function callerFromAuth(result: RouteAuthResult): Caller | Response {
  if (result instanceof Response) return result;
  if (result.authenticator === "app") {
    const familyId = result.attributes.familyId;
    const memberUserId = result.attributes.memberUserId;
    if (
      typeof familyId === "string" &&
      familyId.length > 0 &&
      typeof memberUserId === "string" &&
      memberUserId.length > 0 &&
      result.principalId === memberUserId
    ) {
      return { kind: "app", familyId, memberUserId };
    }
    return sessionNotFound();
  }
  if (
    result.authenticator === "oidc" &&
    result.principalType === "runtime" &&
    result.issuer?.startsWith("https://oidc.vercel.com/")
  ) {
    return { kind: "privileged" };
  }
  if (
    result.authenticator === "local-dev" &&
    result.principalType === "local-dev" &&
    process.env.VERCEL_ENV !== "production"
  ) {
    return { kind: "privileged" };
  }
  return sessionNotFound();
}

function sessionNotFound(): Response {
  return Response.json(
    { error: "Session not found.", ok: false },
    { headers: { "cache-control": "no-store" }, status: 404 },
  );
}

function authorizationUnavailable(): Response {
  return Response.json(
    { error: "Session authorization failed.", ok: false },
    { headers: { "cache-control": "no-store" }, status: 503 },
  );
}

function logAuthorizationStoreFailure(stage: string, error?: unknown): void {
  console.error("eve session authorization store failed", {
    stage,
    ...(error === undefined
      ? {}
      : {
          error: error instanceof Error ? error.message : "unknown",
        }),
  });
}

function isHttpRoute(route: RouteDefinition): route is HttpRouteDefinition {
  return route.transport !== "websocket";
}

function routeKey(route: HttpRouteDefinition): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

function ownerFor(
  args: RouteHandlerArgs,
  caller: Extract<Caller, { kind: "app" }>,
): EveSessionOwner | null {
  const sessionId = args.params.sessionId?.trim() ?? "";
  if (!sessionId) return null;
  return {
    sessionId,
    familyId: caller.familyId,
    memberUserId: caller.memberUserId,
  };
}

function bindingClaimForCreatedSession(
  auth: unknown,
  caller: Extract<Caller, { kind: "app" }>,
): EveSessionBindingClaim | undefined {
  if (typeof auth !== "object" || auth === null) {
    throw new EveSessionAuthorizationError();
  }
  const sessionAuth = auth as {
    principalId?: unknown;
    attributes?: Record<string, unknown>;
  };
  const attributes = sessionAuth.attributes;
  if (
    sessionAuth.principalId !== caller.memberUserId ||
    !attributes ||
    attributes.memberUserId !== caller.memberUserId ||
    (attributes.channel !== "web" && attributes.channel !== "mobile")
  ) {
    throw new EveSessionAuthorizationError();
  }

  const accountWalled = attributes.accountWalled === "true";
  const voiceBridge = attributes.voiceBridge === "true";
  if (
    attributes.familyId !== caller.familyId &&
    !(accountWalled && attributes.familyId === undefined)
  ) {
    throw new EveSessionAuthorizationError();
  }
  if (accountWalled || voiceBridge) return undefined;

  if (
    typeof attributes.episodeId !== "string" ||
    typeof attributes.continuityThreadHash !== "string"
  ) {
    throw new EveSessionAuthorizationError();
  }
  return {
    episodeId: attributes.episodeId,
    threadKeyHash: attributes.continuityThreadHash,
  };
}

async function ownsSession(
  owners: EveSessionOwnerStore,
  owner: EveSessionOwner,
): Promise<boolean | Response> {
  try {
    return await owners.owns(owner);
  } catch (error) {
    logAuthorizationStoreFailure("ownership-read", error);
    return authorizationUnavailable();
  }
}

async function restoreReservation(
  owners: EveSessionOwnerStore,
  owner: EveSessionOwner,
  reservationToken: string,
): Promise<boolean> {
  try {
    return await owners.restoreContinuation(owner, reservationToken);
  } catch (error) {
    logAuthorizationStoreFailure("continuation-restore", error);
    return false;
  }
}

async function revokeAmbiguousContinuation(
  owners: EveSessionOwnerStore,
  owner: EveSessionOwner,
  reservationToken: string,
): Promise<void> {
  try {
    const revoked = await owners.revokeContinuation(owner, reservationToken);
    if (!revoked) logAuthorizationStoreFailure("continuation-revoke");
  } catch (error) {
    logAuthorizationStoreFailure("continuation-revoke", error);
  }
}

async function cancelProvision(
  owners: EveSessionOwnerStore,
  provisionId: string,
  principal: EveSessionPrincipal,
  provisionalToken: string,
): Promise<void> {
  try {
    const cancelled = await owners.cancel(
      provisionId,
      principal,
      provisionalToken,
    );
    if (!cancelled) logAuthorizationStoreFailure("provision-cancel");
  } catch (error) {
    logAuthorizationStoreFailure("provision-cancel", error);
  }
}

export function protectEveSessionRoutes<TChannel extends Channel>(
  channel: TChannel,
  deps: {
    resolveAuth(request: Request): Promise<RouteAuthResult>;
    owners: EveSessionOwnerStore;
  },
): TChannel {
  const expected = new Map([
    [`POST ${CREATE_PATH}`, 0],
    [`POST ${CONTINUE_PATH}`, 0],
    [`GET ${STREAM_PATH}`, 0],
  ]);

  const unexpectedSessionRoutes = channel.routes.filter((route) => {
    if (!route.path.startsWith(CREATE_PATH)) return false;
    return !isHttpRoute(route) || !expected.has(routeKey(route));
  });
  if (unexpectedSessionRoutes.length > 0) {
    throw new Error(
      `Eve session route contract changed: unexpected ${unexpectedSessionRoutes
        .map((route) =>
          isHttpRoute(route) ? routeKey(route) : `WEBSOCKET ${route.path}`,
        )
        .join(", ")}`,
    );
  }

  const routes = channel.routes.map((route) => {
    if (!isHttpRoute(route)) return route;
    const key = routeKey(route);
    if (!expected.has(key)) return route;
    expected.set(key, (expected.get(key) ?? 0) + 1);
    const original = route.handler;

    if (key === `POST ${CREATE_PATH}`) {
      return {
        ...route,
        handler: async (request, args) => {
          const caller = callerFromAuth(await deps.resolveAuth(request));
          if (caller instanceof Response) return caller;
          if (caller.kind === "privileged")
            return await original(request, args);

          const principal = {
            familyId: caller.familyId,
            memberUserId: caller.memberUserId,
          };
          const provisionalToken = `eve-provision:${randomUUID()}`;
          let provisionId: string | null = null;
          try {
            provisionId = await deps.owners.provision(
              principal,
              provisionalToken,
            );
          } catch (error) {
            logAuthorizationStoreFailure("provision", error);
            return authorizationUnavailable();
          }
          if (!provisionId) {
            logAuthorizationStoreFailure("provision");
            return authorizationUnavailable();
          }
          const activeProvisionId = provisionId;

          let registeredSessionId: string | null = null;
          let registeredContinuationToken: string | null = null;
          let sendStarted = false;
          let provisionOpen = true;
          const wrappedArgs: RouteHandlerArgs = {
            ...args,
            send: async (input, options) => {
              if (sendStarted || registeredSessionId !== null) {
                throw new EveSessionAuthorizationError();
              }
              sendStarted = true;
              const binding = bindingClaimForCreatedSession(
                options.auth,
                caller,
              );

              let session: Awaited<ReturnType<typeof args.send>>;
              try {
                session = await args.send(input, options);
              } catch (error) {
                await cancelProvision(
                  deps.owners,
                  activeProvisionId,
                  principal,
                  provisionalToken,
                );
                provisionOpen = false;
                throw error;
              }
              const owner = {
                sessionId: session.id,
                familyId: caller.familyId,
                memberUserId: caller.memberUserId,
              };
              let activated = false;
              try {
                activated = await deps.owners.activate(
                  activeProvisionId,
                  owner,
                  provisionalToken,
                  session.continuationToken,
                  binding,
                );
              } catch (error) {
                logAuthorizationStoreFailure("activation", error);
                await cancelProvision(
                  deps.owners,
                  activeProvisionId,
                  principal,
                  provisionalToken,
                );
                provisionOpen = false;
                throw new EveSessionAuthorizationError();
              }
              if (!activated) {
                logAuthorizationStoreFailure("activation");
                await cancelProvision(
                  deps.owners,
                  activeProvisionId,
                  principal,
                  provisionalToken,
                );
                provisionOpen = false;
                throw new EveSessionAuthorizationError();
              }
              provisionOpen = false;
              registeredSessionId = session.id;
              registeredContinuationToken = session.continuationToken;
              return session;
            },
          };
          try {
            const response = await original(request, wrappedArgs);
            if (registeredSessionId) {
              let responseBody: {
                continuationToken?: unknown;
                sessionId?: unknown;
              };
              try {
                responseBody = (await response
                  .clone()
                  .json()) as typeof responseBody;
              } catch {
                throw new EveSessionAuthorizationError();
              }
              if (
                response.status !== 202 ||
                response.headers.get(SESSION_ID_HEADER) !==
                  registeredSessionId ||
                responseBody.sessionId !== registeredSessionId ||
                responseBody.continuationToken !== registeredContinuationToken
              ) {
                throw new EveSessionAuthorizationError();
              }
            } else if (response.status === 202) {
              throw new EveSessionAuthorizationError();
            }
            if (provisionOpen) {
              await cancelProvision(
                deps.owners,
                activeProvisionId,
                principal,
                provisionalToken,
              );
              provisionOpen = false;
            }
            return response;
          } catch (error) {
            if (provisionOpen) {
              await cancelProvision(
                deps.owners,
                activeProvisionId,
                principal,
                provisionalToken,
              );
              provisionOpen = false;
            }
            if (!(error instanceof EveSessionAuthorizationError)) throw error;
            return authorizationUnavailable();
          }
        },
      } satisfies HttpRouteDefinition;
    }

    if (key === `POST ${CONTINUE_PATH}`) {
      return {
        ...route,
        handler: async (request, args) => {
          const caller = callerFromAuth(await deps.resolveAuth(request));
          if (caller instanceof Response) return caller;
          if (caller.kind === "privileged")
            return await original(request, args);
          const owner = ownerFor(args, caller);
          if (!owner) return sessionNotFound();

          let continuationToken = "";
          try {
            const body = (await request.clone().json()) as {
              continuationToken?: unknown;
            };
            continuationToken =
              typeof body.continuationToken === "string"
                ? body.continuationToken
                : "";
          } catch {
            return sessionNotFound();
          }
          if (
            continuationToken.length === 0 ||
            continuationToken.length > MAX_CONTINUATION_TOKEN_LENGTH
          ) {
            return sessionNotFound();
          }

          const reservationToken = `eve-owner:${randomUUID()}`;
          let reserved = false;
          try {
            reserved = await deps.owners.reserveContinuation(
              owner,
              continuationToken,
              reservationToken,
            );
          } catch (error) {
            logAuthorizationStoreFailure("continuation-reserve", error);
            return authorizationUnavailable();
          }
          if (!reserved) return sessionNotFound();

          let sendStarted = false;
          let sentSessionId: string | null = null;
          const wrappedArgs: RouteHandlerArgs = {
            ...args,
            send: async (input, options) => {
              if (options.continuationToken !== continuationToken) {
                throw new EveSessionAuthorizationError();
              }
              sendStarted = true;
              const session = await args.send(input, options);
              if (
                session.id !== owner.sessionId ||
                session.continuationToken !== continuationToken
              ) {
                throw new EveSessionAuthorizationError();
              }
              sentSessionId = session.id;
              return session;
            },
          };

          try {
            const response = await original(request, wrappedArgs);
            if (!sendStarted) {
              const restored = await restoreReservation(
                deps.owners,
                owner,
                reservationToken,
              );
              if (!restored) return authorizationUnavailable();
            }
            if (sentSessionId) {
              let responseBody: Record<string, unknown> | null = null;
              try {
                responseBody = (await response.clone().json()) as Record<
                  string,
                  unknown
                >;
              } catch {
                responseBody = null;
              }
              if (
                responseBody === null ||
                response.status !== 200 ||
                response.headers.get(SESSION_ID_HEADER) !== sentSessionId ||
                responseBody.sessionId !== sentSessionId ||
                Object.hasOwn(responseBody, "continuationToken")
              ) {
                await revokeAmbiguousContinuation(
                  deps.owners,
                  owner,
                  reservationToken,
                );
                return authorizationUnavailable();
              }

              let completed = false;
              try {
                completed = await deps.owners.completeContinuation(
                  owner,
                  reservationToken,
                  continuationToken,
                );
              } catch (error) {
                logAuthorizationStoreFailure("continuation-complete", error);
                await revokeAmbiguousContinuation(
                  deps.owners,
                  owner,
                  reservationToken,
                );
                return authorizationUnavailable();
              }
              if (!completed) {
                await revokeAmbiguousContinuation(
                  deps.owners,
                  owner,
                  reservationToken,
                );
                return authorizationUnavailable();
              }
            }
            return response;
          } catch (error) {
            if (!sendStarted) {
              const restored = await restoreReservation(
                deps.owners,
                owner,
                reservationToken,
              );
              if (!restored) return authorizationUnavailable();
            } else {
              await revokeAmbiguousContinuation(
                deps.owners,
                owner,
                reservationToken,
              );
              return authorizationUnavailable();
            }
            if (!(error instanceof EveSessionAuthorizationError)) throw error;
            return authorizationUnavailable();
          }
        },
      } satisfies HttpRouteDefinition;
    }

    return {
      ...route,
      handler: async (request, args) => {
        const caller = callerFromAuth(await deps.resolveAuth(request));
        if (caller instanceof Response) return caller;
        if (caller.kind === "privileged") return await original(request, args);
        const owner = ownerFor(args, caller);
        if (!owner) return sessionNotFound();
        const owned = await ownsSession(deps.owners, owner);
        if (owned instanceof Response) return owned;
        if (!owned) return sessionNotFound();
        return await original(request, args);
      },
    } satisfies HttpRouteDefinition;
  });

  const mismatched = [...expected.entries()].filter(([, count]) => count !== 1);
  if (mismatched.length > 0) {
    throw new Error(
      `Eve session route contract changed: ${mismatched
        .map(([key, count]) => `${key} found ${count}`)
        .join(", ")}`,
    );
  }
  return { ...channel, routes } as TChannel;
}
