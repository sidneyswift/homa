import { routeAuth, type AuthFn } from "eve/channels/auth";

import { protectEveSessionHandleRoutes } from "./eve-session-handle-channel";
import { eveSessionHandleOperationKeys, type SessionHandleRouteArgs } from "./eve-session-handle-authorization";
import { protectLegacyEveSessionRoutes, type LegacyEveChannel } from "./eve-session-legacy-routes";
import type { EveSessionOwnerStore } from "./eve-session-owners";

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

interface RouteMetadata {
  readonly method?: string;
  readonly path: string;
  readonly transport?: string;
  readonly handler?: unknown;
}
const SESSION_PREFIX = "/eve/v1/session";
const LEGACY_KEYS = [
  `POST ${SESSION_PREFIX}`,
  `POST ${SESSION_PREFIX}/:sessionId`,
  `GET ${SESSION_PREFIX}/:sessionId/stream`,
];
const HANDLE_KEYS = [`POST ${SESSION_PREFIX}`, ...eveSessionHandleOperationKeys()];

/** Select only complete, reviewed route contracts. No unknown session route is
 * returned unwrapped. Each implementation rechecks its protocol and authenticates
 * before invoking the original route handler with the preserved runtime context. */
export function protectEveSessionRoutes<TChannel extends { readonly routes: readonly RouteMetadata[] }>(
  channel: TChannel,
  deps: { resolveAuth(request: Request): Promise<RouteAuthResult>; owners: EveSessionOwnerStore },
): TChannel {
  const routes = channel.routes.filter(route => route.path.startsWith(SESSION_PREFIX));
  const known = new Set([...LEGACY_KEYS, ...HANDLE_KEYS]);
  const keyFor = (route: RouteMetadata) => `${route.method?.toUpperCase()} ${route.path}`;
  const unexpected = routes.filter(route =>
    (route.transport !== undefined && route.transport !== "http") ||
    typeof route.handler !== "function" || !known.has(keyFor(route)));
  if (unexpected.length) {
    throw new Error(`Eve session route contract changed: unexpected ${unexpected.map(route =>
      route.transport === "websocket" ? `WEBSOCKET ${route.path}` : keyFor(route)).join(", ")}`);
  }
  const matches = (keys: readonly string[]) => routes.length === keys.length && keys.every(key =>
    routes.filter(route => keyFor(route) === key).length === 1);
  // This is the version boundary: SDK route handler argument types changed while
  // the HTTP paths stayed partly shared. The exact complete route set selects the
  // tested implementation; these casts never change a handler or runtime value.
  if (matches(HANDLE_KEYS)) {
    type HandleChannel = { readonly routes: readonly ({
      readonly method?: string; readonly path: string; readonly transport?: "http";
      readonly handler?: (request: Request, args: SessionHandleRouteArgs) => Promise<Response>;
    } | { readonly path: string; readonly transport: "websocket" })[] };
    return protectEveSessionHandleRoutes(channel as unknown as HandleChannel, deps) as unknown as TChannel;
  }
  if (matches(LEGACY_KEYS)) {
    return protectLegacyEveSessionRoutes(channel as unknown as LegacyEveChannel, deps) as unknown as TChannel;
  }
  throw new Error(`Eve session route contract changed: expected one complete reviewed route set; found ${routes.map(route => `${route.transport === "websocket" ? "WEBSOCKET" : route.method?.toUpperCase()} ${route.path}`).join(", ")}`);
}
