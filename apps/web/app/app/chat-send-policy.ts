import { isHiddenDirective } from "../../lib/onboarding/directives";

export type ChatTurnModality = "text" | "voice";

export type ChatSendSource =
  | { kind: "composer" }
  | { kind: "progress_card"; progressActionKey: string }
  | { kind: "question_card" }
  /**
   * A machine message the client says on the parent's behalf: the
   * onboarding kickoff, the resume pickup, a checklist handoff. It
   * renders as no bubble and persists internal
   * (lib/onboarding/directives.ts), and it gets its own send lane below.
   */
  | { kind: "directive" };

export type ChatSendAcceptance = "rejected" | "queued" | "sent";

/**
 * Which lane a queued message rides in. Directives never string-join
 * with the parent's words: a machine sentence glued onto the front of
 * what she was typing arrives wearing her voice, and the model answers
 * a sentence nobody wrote.
 */
export type ChatSendLane = "parent" | "directive";

export interface PreparedChatSend {
  message: string;
  destination: "queue" | "send";
  modality: ChatTurnModality;
  clearDraft: boolean;
  resetDraftFromVoice: boolean;
  progressActionKey: string | null;
  lane: ChatSendLane;
}

export interface QueuedChatMessage {
  text: string;
  progressActionKey: string | null;
  lane: ChatSendLane;
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
  // A directive is not typing either, and it is not hers. It touches
  // neither her draft nor the voice flag. The lane is decided by the
  // marker grammar rather than by the caller's say-so, so a caller that
  // forgets the source kind still cannot leak a marker into her words.
  const directive = input.source.kind === "directive" || isHiddenDirective(message);
  return {
    message,
    destination: input.busy ? "queue" : "send",
    modality:
      fromCard || directive
        ? "text"
        : input.draftFromVoice
          ? "voice"
          : "text",
    clearDraft: !fromCard && !directive,
    resetDraftFromVoice: !fromCard && !directive,
    progressActionKey:
      input.source.kind === "progress_card"
        ? input.source.progressActionKey
        : null,
    lane: directive ? "directive" : "parent",
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
  // A directive that is already waiting is already going to be said.
  // Kickoffs in particular can fire twice across a remount, and two
  // openings in a row read as Homa forgetting she already said hello.
  if (
    plan.lane === "directive" &&
    queue.some((entry) => entry.lane === "directive" && entry.text === plan.message)
  ) {
    return queue;
  }
  return [
    ...queue,
    {
      text: plan.message,
      progressActionKey: plan.progressActionKey,
      lane: plan.lane,
    },
  ];
}

export interface ChatQueueFlush {
  /** The turn to send now, or null when there is nothing to say. */
  outgoing: string | null;
  /** What stays queued for the next idle line. */
  remaining: QueuedChatMessage[];
  lane: ChatSendLane;
}

/**
 * flushChatQueue(queue, appended?): the one place a queue becomes a
 * turn.
 *
 * Order is first-in-first-out, because the queue's order is the real
 * chronological order of what happened: a checklist that finished
 * mid-turn happened before the sentence she typed after it, and the
 * model has to hear it that way or it answers her reaction without the
 * event that caused it.
 *
 * Within that order, one rule: a directive goes alone. The flush takes
 * either a single directive or the leading run of parent messages,
 * never a mix. Parent messages still join with a blank line between
 * them, exactly as they did before onboarding existed.
 */
export function flushChatQueue(
  queue: QueuedChatMessage[],
  appended?: { text: string; lane: ChatSendLane; progressActionKey?: string | null },
): ChatQueueFlush {
  const all: QueuedChatMessage[] = appended
    ? [
        ...queue,
        {
          text: appended.text,
          progressActionKey: appended.progressActionKey ?? null,
          lane: appended.lane,
        },
      ]
    : [...queue];
  if (all.length === 0) return { outgoing: null, remaining: [], lane: "parent" };

  if (all[0].lane === "directive") {
    return { outgoing: all[0].text, remaining: all.slice(1), lane: "directive" };
  }
  let end = 0;
  while (end < all.length && all[end].lane === "parent") end += 1;
  return {
    outgoing: all
      .slice(0, end)
      .map((entry) => entry.text)
      .join("\n\n"),
    remaining: all.slice(end),
    lane: "parent",
  };
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
