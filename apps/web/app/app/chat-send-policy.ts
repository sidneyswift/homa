export type ChatTurnModality = "text" | "voice";

export type ChatSendSource =
  | { kind: "composer" }
  | { kind: "progress_card"; progressActionKey: string }
  | { kind: "question_card" };

export type ChatSendAcceptance = "rejected" | "queued" | "sent";

export interface PreparedChatSend {
  message: string;
  destination: "queue" | "send";
  modality: ChatTurnModality;
  clearDraft: boolean;
  resetDraftFromVoice: boolean;
  progressActionKey: string | null;
}

export interface QueuedChatMessage {
  text: string;
  progressActionKey: string | null;
}

export function prepareChatSend(input: {
  text: string;
  busy: boolean;
  draftFromVoice: boolean;
  source: ChatSendSource;
}): PreparedChatSend | null {
  const message = input.text.trim();
  if (message.length === 0) return null;
  // A tap on a card is not typing: it stays a text turn and it leaves
  // whatever she had half-written in the composer alone.
  const fromCard =
    input.source.kind === "progress_card" || input.source.kind === "question_card";
  return {
    message,
    destination: input.busy ? "queue" : "send",
    modality:
      fromCard
        ? "text"
        : input.draftFromVoice
          ? "voice"
          : "text",
    clearDraft: !fromCard,
    resetDraftFromVoice: !fromCard,
    progressActionKey:
      input.source.kind === "progress_card"
        ? input.source.progressActionKey
        : null,
  };
}

export function appendPreparedChatSendToQueue(
  queue: QueuedChatMessage[],
  plan: PreparedChatSend,
): QueuedChatMessage[] {
  if (plan.destination !== "queue") {
    throw new TypeError("Only queued chat sends can enter the queue");
  }
  if (
    plan.progressActionKey !== null &&
    queue.some(
      (entry) =>
        entry.progressActionKey === plan.progressActionKey,
    )
  ) {
    return queue;
  }
  return [
    ...queue,
    {
      text: plan.message,
      progressActionKey: plan.progressActionKey,
    },
  ];
}

export interface ChatComposerForm {
  querySelector(
    selector: "input",
  ): { focus(): void } | null;
}

export function focusChatComposerInput(
  form: ChatComposerForm | null,
): void {
  form?.querySelector("input")?.focus();
}
