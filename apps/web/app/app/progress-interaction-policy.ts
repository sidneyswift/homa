import type { EveMessage } from "eve/react";

import {
  parseProgressMessagePart,
  type ProgressAssistantItem,
} from "./progress-message-parts";

export interface ProgressMessageInteraction {
  messageId: string;
  partIndex: number;
  partKey: string;
  actionKey: string;
}

function progressItemHasAction(item: ProgressAssistantItem): boolean {
  switch (item.kind) {
    case "progress_update":
      return item.update.undoAvailable;
    case "progress_question":
    case "progress_conflict":
      return true;
    case "progress_workflow":
      return item.update?.undoAvailable === true;
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
}

function progressPartActionState(
  part: EveMessage["parts"][number],
): "none" | "read_only" | "actionable" {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "manage_child_progress"
  ) {
    return "none";
  }
  if (part.state !== "output-available") return "read_only";
  const item = parseProgressMessagePart(part);
  if (!item) return "read_only";
  return progressItemHasAction(item) ? "actionable" : "read_only";
}

/**
 * Returns the one current live progress message that may accept an action.
 * A later user turn or later read-only progress result makes prior cards stale.
 */
export function latestProgressMessageInteraction(input: {
  messages: readonly EveMessage[];
  sessionKey: string;
  unavailableActionKeys: ReadonlySet<string>;
}): ProgressMessageInteraction | null {
  let latest: Omit<ProgressMessageInteraction, "actionKey"> | null =
    null;
  for (const message of input.messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const actionState = progressPartActionState(part);
      if (actionState === "actionable") {
        latest = {
          messageId: message.id,
          partIndex,
          partKey: `${message.id}:${partIndex}`,
        };
      } else if (actionState === "read_only") {
        latest = null;
      }
    }
  }
  if (latest === null) return null;
  const actionKey =
    `progress-card:${input.sessionKey}:${latest.partKey}`;
  if (input.unavailableActionKeys.has(actionKey)) return null;
  return { ...latest, actionKey };
}
