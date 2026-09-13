import { randomUUID } from "node:crypto";

import { bindingClaimForCreatedSession, EveSessionAuthorizationError } from "./eve-session-creation-binding";
import type { EveSessionOwnerStore } from "./eve-session-owners";
import { authorizationUnavailable, callerFromAuth, type EveSessionRouteAuthResult } from "./eve-session-route-auth";

interface CreatedSession { readonly sessionId: string }
interface CreateInput { readonly auth?: unknown }
type CreateSession = (input: CreateInput) => Promise<CreatedSession>;
type ObserveCreation = (input: CreateInput, create: () => Promise<CreatedSession>) => Promise<CreatedSession>;
const SESSION_ID_HEADER = "x-eve-session-id";
const CREATOR_KEY = "__eveRouteSessionCreator";

/**
 * Version-specific bridge for Eve 0.54.3's route creation context. Eve's public
 * route args no longer expose send/create. This checked bridge must be exercised
 * against the published candidate handler before any future version change.
 */
export function observeEveRouteCreation<TArgs extends object>(args: TArgs, observe: ObserveCreation): TArgs {
  const creator = (args as Record<string, unknown>)[CREATOR_KEY];
  if (typeof creator !== "function") throw new EveSessionAuthorizationError();
  return {
    ...args,
    [CREATOR_KEY]: (input: CreateInput) => observe(input, () => (creator as CreateSession).call(args, input)),
  };
}

interface CreationRoute<TArgs extends object> {
  readonly method: string;
  readonly path: string;
  readonly transport?: string;
  readonly handler: (request: Request, args: TArgs) => Promise<Response>;
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 255 && value.trim() === value;
}

/** Staged candidate creation path; it does not enable the newer Eve channel. */
export function protectEveSessionHandleCreation<TArgs extends object>(
  route: CreationRoute<TArgs>,
  deps: {
    resolveAuth(request: Request): Promise<EveSessionRouteAuthResult>;
    owners: Pick<EveSessionOwnerStore, "provision" | "activate" | "cancel" | "owns">;
  },
): CreationRoute<TArgs> {
  if (route.method.toUpperCase() !== "POST" || route.path !== "/eve/v1/session" || route.transport === "websocket") {
    throw new Error("Unsupported Eve session creation route.");
  }
  return {
    ...route,
    handler: async (request, args) => {
      let caller;
      try { caller = callerFromAuth(await deps.resolveAuth(request)); }
      catch { return authorizationUnavailable(); }
      if (caller instanceof Response) return caller;
      if (caller.kind === "privileged") return route.handler(request, args);
      const principal = { familyId: caller.familyId, memberUserId: caller.memberUserId };
      const provisionalToken = `eve-provision:${randomUUID()}`;
      let provisionId;
      try { provisionId = await deps.owners.provision(principal, provisionalToken); }
      catch { return authorizationUnavailable(); }
      if (!provisionId) return authorizationUnavailable();
      const reservation = provisionId;
      let provisionOpen = true;
      let creationAttempted = false;
      let guardFailed = false;
      let registeredId: string | undefined;
      function refuse(): never { guardFailed = true; throw new EveSessionAuthorizationError(); }

      let response: Response;
      try {
        const wrappedArgs = observeEveRouteCreation(args, async (input, create) => {
          if (creationAttempted) refuse();
          creationAttempted = true;
          let binding;
          try { binding = bindingClaimForCreatedSession(input.auth, caller); }
          catch { refuse(); }
          const handle = await create();
          if (!validSessionId(handle?.sessionId)) refuse();
          let activated;
          try {
            activated = await deps.owners.activate(
              reservation,
              { ...principal, sessionId: handle.sessionId },
              provisionalToken,
              // The existing storage column remains populated without exposing
              // a runtime continuation credential to a handle-based client.
              `eve-owner:${randomUUID()}`,
              binding,
            );
          } catch { refuse(); }
          if (!activated) refuse();
          provisionOpen = false;
          registeredId = handle.sessionId;
          return handle;
        });
        response = await route.handler(request, wrappedArgs);
        if (guardFailed) refuse();
        if (registeredId || response.status === 202) {
          const body = await response.clone().json() as { ok?: unknown; sessionId?: unknown };
          if (
            response.status !== 202 || body.ok !== true || !validSessionId(body.sessionId) ||
            response.headers.get(SESSION_ID_HEADER) !== body.sessionId
          ) refuse();
          if (registeredId) {
            if (body.sessionId !== registeredId) refuse();
          } else {
            // Eve may short-circuit a retried operation before invoking creation.
            // Never adopt a new or foreign ID based only on that response.
            if (creationAttempted || !await deps.owners.owns({ ...principal, sessionId: body.sessionId })) refuse();
          }
        } else if (response.ok || response.headers.has(SESSION_ID_HEADER)) {
          refuse();
        }
      } catch {
        response = authorizationUnavailable();
      }
      if (provisionOpen) {
        try {
          if (!await deps.owners.cancel(reservation, principal, provisionalToken)) return authorizationUnavailable();
        } catch { return authorizationUnavailable(); }
      }
      return response;
    },
  };
}
