export type ChatTurnModality = "text" | "voice";

export type ChatSendSource =
  | { kind: "composer" }
  | { kind: "progress_card"; progressActionKey: string };

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
  const fromProgressCard = input.source.kind === "progress_card";
  return {
    message,
    destination: input.busy ? "queue" : "send",
    modality:
      fromProgressCard
        ? "text"
        : input.draftFromVoice
          ? "voice"
          : "text",
    clearDraft: !fromProgressCard,
    resetDraftFromVoice: !fromProgressCard,
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
