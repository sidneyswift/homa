import type { EveSessionOwner } from "./eve-session-owners";
import {
  authorizationUnavailable,
  callerFromAuth,
  sessionNotFound,
  type EveSessionRouteAuthResult,
} from "./eve-session-route-auth";

const SESSION_PATH = "/eve/v1/session/:sessionId";
const OWNER_PARAMETER = new Map([
  [`POST ${SESSION_PATH}`, "sessionId"],
  [`POST ${SESSION_PATH}/cancel`, "sessionId"],
  [`POST ${SESSION_PATH}/compact`, "sessionId"],
  [`POST ${SESSION_PATH}/clear`, "sessionId"],
  [`POST ${SESSION_PATH}/reset`, "sessionId"],
  [`GET ${SESSION_PATH}/stream`, "sessionId"],
  ["GET /eve/v1/session/:parentSessionId/subagents/:callId/:childSessionId/stream", "parentSessionId"],
]);

/** Structural types allow testing the September protocol before changing the Eve pin. */
export interface SessionHandleRouteArgs<TSession = unknown> {
  readonly params: Readonly<Record<string, string>>;
  attachSession(sessionId: string): TSession;
}

interface SessionHandleRoute<TArgs extends SessionHandleRouteArgs> {
  readonly method: string;
  readonly path: string;
  readonly transport?: string;
  readonly handler: (request: Request, args: TArgs) => Promise<Response>;
}

/**
 * Guards one existing-session operation. Creation is deliberately excluded:
 * it must reserve and activate an owner before returning a session to a client.
 * Not wired into the legacy channel until the candidate creation path is ready.
 */
export function protectEveSessionHandleOperation<TArgs extends SessionHandleRouteArgs>(
  route: SessionHandleRoute<TArgs>,
  deps: {
    resolveAuth(request: Request): Promise<EveSessionRouteAuthResult>;
    owns(owner: EveSessionOwner): Promise<boolean>;
  },
): SessionHandleRoute<TArgs> {
  const parameter = OWNER_PARAMETER.get(`${route.method.toUpperCase()} ${route.path}`);
  if (route.transport === "websocket" || !parameter) {
    throw new Error("Unsupported Eve session handle operation.");
  }
  return {
    ...route,
    handler: async (request, args) => {
      let caller;
      try {
        caller = callerFromAuth(await deps.resolveAuth(request));
      } catch {
        return authorizationUnavailable();
      }
      if (caller instanceof Response) return caller;
      if (caller.kind === "privileged") return route.handler(request, args);

      const sessionId = args.params[parameter];
      if (typeof sessionId !== "string" || !sessionId || sessionId.length > 255 || sessionId.trim() !== sessionId) {
        return sessionNotFound();
      }
      try {
        const owned = await deps.owns({
          sessionId, familyId: caller.familyId, memberUserId: caller.memberUserId,
        });
        if (!owned) return sessionNotFound();
      } catch {
        return authorizationUnavailable();
      }

      // Eve verifies a child-stream request against events on this owned parent.
      // Do not authorize the child merely because the client supplied its ID.
      let attemptedForeignAttach = false;
      const guardedArgs: TArgs = {
        ...args,
        attachSession: (id: string) => {
          if (id !== sessionId) {
            attemptedForeignAttach = true;
            throw new Error("Eve session handle scope changed.");
          }
          return args.attachSession(id);
        },
      };
      try {
        const response = await route.handler(request, guardedArgs);
        return attemptedForeignAttach ? sessionNotFound() : response;
      } catch (error) {
        if (attemptedForeignAttach) return sessionNotFound();
        throw error;
      }
    },
  };
}
