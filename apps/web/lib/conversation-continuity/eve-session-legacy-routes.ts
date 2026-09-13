import { randomUUID } from "node:crypto";

import { bindingClaimForCreatedSession, EveSessionAuthorizationError } from "./eve-session-creation-binding";
import {
  authorizationUnavailable, callerFromAuth, sessionNotFound,
  type EveSessionCaller as Caller, type EveSessionRouteAuthResult as RouteAuthResult,
} from "./eve-session-route-auth";
import type { EveSessionOwner, EveSessionOwnerStore, EveSessionPrincipal } from "./eve-session-owners";

/** The token protocol is retained for the current Eve pin and historical tests.
 * Only the fields this guard observes are typed here; all runtime context fields
 * and the original returned session object pass through unchanged. */
export interface LegacyRouteHandlerArgs {
  readonly params: Readonly<Record<string, string>>;
  send(input: unknown, options: { auth: unknown; continuationToken?: string }): Promise<{
    id: string;
    continuationToken: string;
  }>;
}
export interface LegacyHttpRoute {
  readonly method: string;
  readonly path: string;
  readonly transport?: "http";
  readonly handler: (request: Request, args: LegacyRouteHandlerArgs) => Promise<Response>;
}
type LegacyRoute = LegacyHttpRoute | {
  readonly transport: "websocket";
  readonly path: string;
};
export interface LegacyEveChannel { readonly routes: readonly LegacyRoute[] }

const CREATE_PATH = "/eve/v1/session";
const CONTINUE_PATH = "/eve/v1/session/:sessionId";
const STREAM_PATH = "/eve/v1/session/:sessionId/stream";
const SESSION_ID_HEADER = "x-eve-session-id";
const MAX_CONTINUATION_TOKEN_LENGTH = 8_000;

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

function isHttpRoute(route: LegacyRoute): route is LegacyHttpRoute {
  return route.transport !== "websocket";
}

function routeKey(route: LegacyHttpRoute): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

function ownerFor(
  args: LegacyRouteHandlerArgs,
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

export function protectLegacyEveSessionRoutes<TChannel extends LegacyEveChannel>(
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
          const wrappedArgs: LegacyRouteHandlerArgs = {
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
      } satisfies LegacyHttpRoute;
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
          const wrappedArgs: LegacyRouteHandlerArgs = {
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
      } satisfies LegacyHttpRoute;
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
    } satisfies LegacyHttpRoute;
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
