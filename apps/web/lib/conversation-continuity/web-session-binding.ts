import { hashContinuityKey, type EpisodeBinding } from "./continuity-service";
import { PostgresContinuityRepository } from "./postgres-repository";

export interface WebSessionBinding {
  runtimeSessionId: string;
  lastSeenAtMs: number;
}

export function webSessionThreadHash(memberUserId: string): string {
  return hashContinuityKey(`web:${memberUserId}`);
}

export function clientWebSessionBinding(
  binding: EpisodeBinding | null,
  memberUserId: string,
): WebSessionBinding | null {
  if (
    binding?.channel !== "web" ||
    binding.memberUserId !== memberUserId ||
    !binding.runtimeSessionId
  ) {
    return null;
  }
  return {
    runtimeSessionId: binding.runtimeSessionId,
    lastSeenAtMs: binding.lastSeenAt.getTime(),
  };
}

/**
 * Reads the authenticated adult's stable web binding. The caller derives both
 * ids from server-side auth; the query repeats family, channel, hashed
 * principal, and member checks before returning a runtime session id.
 */
export async function readWebSessionBinding(input: {
  familyId: string;
  memberUserId: string;
}): Promise<WebSessionBinding | null> {
  const binding = await new PostgresContinuityRepository().findBinding(
    input.familyId,
    input.memberUserId,
    "web",
    webSessionThreadHash(input.memberUserId),
  );
  return clientWebSessionBinding(binding, input.memberUserId);
}
