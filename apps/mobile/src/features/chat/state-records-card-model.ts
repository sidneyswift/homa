import type { EveMessagePart } from "eve/react";

import type { StateRecordAction } from "../../lib/state-records";

/**
 * open_state_records tells Homa the phone is opening the family's state
 * records, so chat must actually draw that view. Voice mode already did
 * (features/voice/overlay-model.ts); chat rendered nothing, and Homa said a
 * view had opened when none appeared. Only a result that really opened, with
 * a known action, earns the card.
 */
export function parseStateRecordsCardPart(part: EveMessagePart): { action: StateRecordAction } | null {
  if (part.type !== "dynamic-tool") return null;
  if (part.toolName !== "open_state_records" || part.state !== "output-available") return null;
  const output = part.output as { opened?: unknown; action?: unknown } | null | undefined;
  if (!output || output.opened !== true) return null;
  const action = output.action;
  return action === "view" || action === "generate_pack" || action === "generate_filing"
    ? { action }
    : null;
}
