import { createHash } from "node:crypto";

import type { SessionParent } from "eve/context";

export interface DelegatedSessionLineage {
  childSessionHash: string;
  parentSessionHash: string;
  rootSessionHash: string;
}

function hashSessionId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isParentedEveSession(
  parent: SessionParent | undefined,
): boolean {
  return parent !== undefined;
}

/**
 * Produces a PII-free session lineage for analytics without exposing Eve
 * session identifiers outside runtime state.
 */
export function delegatedSessionLineage(input: {
  childSessionId: string;
  parent: SessionParent;
}): DelegatedSessionLineage {
  return {
    childSessionHash: hashSessionId(input.childSessionId),
    parentSessionHash: hashSessionId(input.parent.sessionId),
    rootSessionHash: hashSessionId(input.parent.rootSessionId),
  };
}
