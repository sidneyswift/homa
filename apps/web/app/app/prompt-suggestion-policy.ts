import type { EveMessage } from "eve/react";

import {
  createPromptSuggestionAssistantFingerprint,
  promptSuggestionRequestSchema,
  type PromptSuggestionRequest,
  type PromptSuggestionSet,
} from "../../lib/chat-suggestions/contract";
import {
  parseProgressMessagePart,
  type ProgressAssistantItem,
} from "./progress-message-parts";
import { parseDetailCardPart } from "./detail-card";
import {
  parseChecklistCardPart,
  parseReportCardPart,
} from "./onboarding-cards";
import { parseSnapCardPart } from "./snap-card";

const PROMPT_SUGGESTION_TRANSCRIPT_MESSAGE_LIMIT = 6;

function progressItemOwnsAction(
  item: ProgressAssistantItem,
): boolean {
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

function visibleMessageText(message: EveMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function assistantMessageOwnsAction(message: EveMessage): boolean {
  for (const part of message.parts) {
    const progressItem = parseProgressMessagePart(part);
    if (progressItem && progressItemOwnsAction(progressItem)) return true;
    if (parseSnapCardPart(part)) return true;
    // The onboarding cards own the floor exactly as the snap card does.
    // This list knew two of the four card kinds, so a checklist invite
    // still spent a model call generating suggestions the rail then had
    // to be separately taught not to show.
    if (parseChecklistCardPart(part)) return true;
    if (parseReportCardPart(part)) return true;
    if (parseDetailCardPart(part)) return true;
  }
  return false;
}

function requestMessageFromEveMessage(
  message: EveMessage,
): PromptSuggestionRequest["messages"][number] | null {
  if (message.role !== "user" && message.role !== "assistant") return null;
  const text = visibleMessageText(message);
  if (text.length === 0) return null;
  return { role: message.role, text };
}

export function promptSuggestionRequestForMessages(
  messages: readonly EveMessage[],
): PromptSuggestionRequest | null {
  const latestMessage = messages.at(-1);
  if (latestMessage?.role !== "assistant") return null;

  const latestText = visibleMessageText(latestMessage);
  if (
    latestText.length === 0
    || latestText.endsWith("?")
    || assistantMessageOwnsAction(latestMessage)
  ) {
    return null;
  }

  const transcript = messages
    .map(requestMessageFromEveMessage)
    .filter((message) => message !== null)
    .slice(-PROMPT_SUGGESTION_TRANSCRIPT_MESSAGE_LIMIT);
  const parsed = promptSuggestionRequestSchema.safeParse({
    assistantMessageId: latestMessage.id,
    messages: transcript,
  });
  return parsed.success ? parsed.data : null;
}

export function promptSuggestionSetMatchesLatestReply(
  messages: readonly EveMessage[],
  set: PromptSuggestionSet | null,
): boolean {
  if (set === null) return false;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant") {
      return (
        message.id === set.assistantMessageId
        || createPromptSuggestionAssistantFingerprint(
          visibleMessageText(message),
        ) === set.assistantMessageFingerprint
      );
    }
  }
  return false;
}

/**
 * Restores a local set only when it belongs to the newest assistant reply
 * visible across archived history and the current resumable session.
 */
export function restorePromptSuggestionSetForVisibleMessages(input: {
  archivedMessages: readonly EveMessage[];
  currentMessages: readonly EveMessage[];
  promptSuggestionSet: PromptSuggestionSet | null;
  staleSessionlessEvents: boolean;
}): PromptSuggestionSet | null {
  if (input.staleSessionlessEvents || input.promptSuggestionSet === null) {
    return null;
  }
  const visibleMessages = [
    ...input.archivedMessages,
    ...input.currentMessages,
  ];
  return promptSuggestionSetMatchesLatestReply(
    visibleMessages,
    input.promptSuggestionSet,
  )
    ? input.promptSuggestionSet
    : null;
}
