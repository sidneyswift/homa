import type { EveSessionBindingClaim } from "./eve-session-owners";
import type { EveSessionCaller } from "./eve-session-route-auth";

export class EveSessionAuthorizationError extends Error {
  constructor() {
    super("Eve session authorization failed.");
    this.name = "EveSessionAuthorizationError";
  }
}

export function bindingClaimForCreatedSession(
  auth: unknown,
  caller: Extract<EveSessionCaller, { kind: "app" }>,
): EveSessionBindingClaim | undefined {
  if (typeof auth !== "object" || auth === null) throw new EveSessionAuthorizationError();
  const sessionAuth = auth as { principalId?: unknown; attributes?: Record<string, unknown> };
  const attributes = sessionAuth.attributes;
  if (
    sessionAuth.principalId !== caller.memberUserId || !attributes ||
    attributes.memberUserId !== caller.memberUserId ||
    (attributes.channel !== "web" && attributes.channel !== "mobile")
  ) {
    throw new EveSessionAuthorizationError();
  }
  const accountWalled = attributes.accountWalled === "true";
  const voiceBridge = attributes.voiceBridge === "true";
  if (attributes.familyId !== caller.familyId && !(accountWalled && attributes.familyId === undefined)) {
    throw new EveSessionAuthorizationError();
  }
  if (accountWalled || voiceBridge) return undefined;
  if (typeof attributes.episodeId !== "string" || typeof attributes.continuityThreadHash !== "string") {
    throw new EveSessionAuthorizationError();
  }
  return { episodeId: attributes.episodeId, threadKeyHash: attributes.continuityThreadHash };
}
