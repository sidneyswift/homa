import { createHash } from "node:crypto";

/** The ledger's legacy uniqueness key does not include family or member.
 * Namespace client voice sessions here before either endpoint writes a turn. */
export function canonicalVoiceSessionId(familyId: string, userId: string, clientSessionId: string): string {
  return `voice-v1:${createHash("sha256").update(JSON.stringify([familyId, userId, clientSessionId])).digest("hex")}`;
}

export function validVoiceSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && value.trim() === value;
}

export function validVoiceSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}
