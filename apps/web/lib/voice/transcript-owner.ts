import { normalizeUsPhoneE164 } from "@homa/core";

/**
 * Telnyx names the human participant explicitly. The agent target is Homa's
 * own endpoint and must never be used to infer which adult owns a transcript.
 */
export function transcriptOwnerPhone(
  metadata: Record<string, string> | undefined,
): string | null {
  return normalizeUsPhoneE164(metadata?.telnyx_end_user_target ?? "");
}
