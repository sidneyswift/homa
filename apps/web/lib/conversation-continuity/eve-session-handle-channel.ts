import {
  eveSessionHandleOperationKeys,
  protectEveSessionHandleOperation,
  type SessionHandleRouteArgs,
} from "./eve-session-handle-authorization";
import { protectEveSessionHandleCreation } from "./eve-session-handle-creation";
import type { EveSessionOwnerStore } from "./eve-session-owners";
import type { EveSessionRouteAuthResult } from "./eve-session-route-auth";

interface CandidateHttpRoute<TArgs extends SessionHandleRouteArgs> {
  readonly method?: string;
  readonly path: string;
  readonly transport?: "http";
  readonly handler?: (request: Request, args: TArgs) => Promise<Response>;
}

type CandidateRoute<TArgs extends SessionHandleRouteArgs> = CandidateHttpRoute<TArgs> | {
  readonly method?: string;
  readonly path: string;
  readonly transport: "websocket";
  readonly handler?: unknown;
};

const CREATE_PATH = "/eve/v1/session";
const CREATE_KEY = `POST ${CREATE_PATH}`;

/** Staged composition for the published handle protocol, not selected by the live channel. */
export function protectEveSessionHandleRoutes<
  TArgs extends SessionHandleRouteArgs,
  TChannel extends { readonly routes: readonly CandidateRoute<TArgs>[] },
>(channel: TChannel & { readonly routes: readonly CandidateRoute<TArgs>[] }, deps: {
  resolveAuth(request: Request): Promise<EveSessionRouteAuthResult>;
  owners: Pick<EveSessionOwnerStore, "provision" | "activate" | "cancel" | "owns">;
}): TChannel {
  const expected = new Map([CREATE_KEY, ...eveSessionHandleOperationKeys()].map(key => [key, 0]));
  // Inspect the whole contract before returning any wrapped route. Future Eve
  // session endpoints need explicit ownership review, including new transports.
  for (const route of channel.routes) {
    if (!route.path.startsWith(CREATE_PATH)) continue;
    const key = `${route.method?.toUpperCase()} ${route.path}`;
    if (route.transport === "websocket" || !expected.has(key) || typeof route.handler !== "function") {
      throw new Error(`Eve session handle route contract changed: unexpected ${key}`);
    }
    expected.set(key, expected.get(key)! + 1);
  }
  const mismatched = [...expected].filter(([, count]) => count !== 1);
  if (mismatched.length) {
    throw new Error(`Eve session handle route contract changed: ${mismatched.map(([key, count]) => `${key} found ${count}`).join(", ")}`);
  }
  const routes = channel.routes.map(route => {
    if (!route.path.startsWith(CREATE_PATH)) return route;
    if (route.transport === "websocket") throw new Error("Unsupported Eve session WebSocket route.");
    const http = { ...route, method: route.method!, handler: route.handler! };
    return `${http.method.toUpperCase()} ${http.path}` === CREATE_KEY
      ? protectEveSessionHandleCreation(http, deps)
      : protectEveSessionHandleOperation(http, {
        resolveAuth: deps.resolveAuth,
        owns: owner => deps.owners.owns(owner),
      });
  });
  return { ...channel, routes } as TChannel;
}
