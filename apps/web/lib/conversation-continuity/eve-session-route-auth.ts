import type { routeAuth } from "eve/channels/auth";

export type EveSessionRouteAuthResult = Awaited<ReturnType<typeof routeAuth>>;

export type EveSessionCaller =
  | { kind: "app"; familyId: string; memberUserId: string }
  | { kind: "privileged" };

export function sessionNotFound(): Response {
  return Response.json(
    { error: "Session not found.", ok: false },
    { headers: { "cache-control": "no-store" }, status: 404 },
  );
}

export function authorizationUnavailable(): Response {
  return Response.json(
    { error: "Session authorization failed.", ok: false },
    { headers: { "cache-control": "no-store" }, status: 503 },
  );
}

/** Classifies an already verified route principal; never accepts client identity fields. */
export function callerFromAuth(result: EveSessionRouteAuthResult): EveSessionCaller | Response {
  if (result instanceof Response) return result;
  if (result.authenticator === "app") {
    const familyId = result.attributes.familyId;
    const memberUserId = result.attributes.memberUserId;
    if (
      typeof familyId === "string" && familyId.length > 0 &&
      typeof memberUserId === "string" && memberUserId.length > 0 &&
      result.principalId === memberUserId
    ) {
      return { kind: "app", familyId, memberUserId };
    }
    return sessionNotFound();
  }
  if (
    result.authenticator === "oidc" && result.principalType === "runtime" &&
    result.issuer?.startsWith("https://oidc.vercel.com/")
  ) {
    return { kind: "privileged" };
  }
  if (
    result.authenticator === "local-dev" && result.principalType === "local-dev" &&
    process.env.VERCEL_ENV !== "production"
  ) {
    return { kind: "privileged" };
  }
  return sessionNotFound();
}
