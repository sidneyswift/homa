import { isHiddenDirective } from "../../lib/onboarding/directives";
import {
  isVoiceTranscriptionText,
  markVoiceTranscription,
} from "../../lib/voice/transcription-marker";
import { messageModalityHeaders } from "../../lib/web-message-modality";
import { messageSourceHeaders } from "../../lib/chat-message-source";

export type ChatTurnModality = "text" | "voice";

export type ChatSendSource =
  | { kind: "composer" }
  | { kind: "progress_card"; progressActionKey: string }
  | { kind: "question_card" }
  /** A card the composer was standing in for. Her entries go out as an
   *  ordinary message so Homa reacts to them, but nothing about it came
   *  from the composer, so the draft is left alone. */
  | { kind: "card_answer" }
  /**
   * A machine message the client says on the parent's behalf: the
   * onboarding kickoff, the resume pickup, a checklist handoff. It
   * renders as no bubble and persists internal
   * (lib/onboarding/directives.ts), and it gets its own send lane below.
   */
  | { kind: "directive" };

export type ChatSendAcceptance = "rejected" | "queued" | "sent";

/**
 * Which lane a queued message rides in. Directives and saved card answers
 * never string-join with the parent's typed words. Each carries different
 * provenance, and one request can truthfully carry only one source header.
 */
export type ChatSendLane = "parent" | "saved_card_answer" | "directive";

export function chatSendHeaders(
  modality: ChatTurnModality,
  lane: ChatSendLane,
): Readonly<Record<string, string>> {
  return {
    ...messageModalityHeaders(modality),
    ...messageSourceHeaders(
      lane === "saved_card_answer" ? "saved_card_answer" : "parent",
    ),
  };
}

/**
 * isSendLineOccupied({busy, recovering}): whether a manual send right now
 * would land on a turn that already has an unsettled outcome, and so must
 * queue instead of starting a fresh eve session.
 *
 * `busy` alone used to be the whole answer, but that missed a real window:
 * when a stream dies mid-turn without a closing boundary event, eve's own
 * client wipes its local session cursor (advanceSession in eve's
 * session-utils, no fix available from here), so `agent.session?.sessionId`
 * goes back to undefined even though the durable turn is very likely still
 * finishing server-side. `agent.status` flips to `"error"` in that same
 * moment, so `busy` is already false. Lost-turn recovery
 * (turn-recovery.ts) exists exactly to find out whether that old turn
 * settled, but it can take up to RECOVERY_DEADLINE_MS (chat-client.tsx) to
 * decide. A manual send in that window used to see no session id and no
 * "busy" status, and started a brand new eve session while the old one was
 * still very much alive: two sessions running for the same family,
 * whichever one she is not looking at when its reply lands is the one that
 * reads as "my message disappeared" (GH #170, the 2026-07-24 and
 * 2026-07-25 co-founder incidents). Recovering is exactly that
 * undecided window, so it occupies the line the same way busy does.
 */
export function isSendLineOccupied(input: {
  busy: boolean;
  recovering: boolean;
}): boolean {
  return input.busy || input.recovering;
}

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
  modality: ChatTurnModality;
}

export function prepareChatSend(input: {
  text: string;
  busy: boolean;
  draftFromVoice: boolean;
  source: ChatSendSource;
}): PreparedChatSend | null {
  const rawMessage = input.text.trim();
  if (rawMessage.length === 0) return null;
  // A tap on a card is not typing: it stays a text turn and it leaves
  // whatever she had half-written in the composer alone.
  const fromCard =
    input.source.kind === "progress_card" ||
    input.source.kind === "question_card" ||
    input.source.kind === "card_answer";
  // A directive is not typing either, and it is not hers. It touches
  // neither her draft nor the voice flag. The lane is decided by the
  // marker grammar rather than by the caller's say-so, so a caller that
  // forgets the source kind still cannot leak a marker into her words.
  const directive =
    input.source.kind === "directive" || isHiddenDirective(rawMessage);
  const modality: ChatTurnModality =
    fromCard || directive
      ? "text"
      : input.draftFromVoice || isVoiceTranscriptionText(rawMessage)
        ? "voice"
        : "text";
  const message =
    modality === "voice" ? markVoiceTranscription(rawMessage) : rawMessage;
  return {
    message,
    destination: input.busy ? "queue" : "send",
    modality,
    clearDraft: !fromCard && !directive,
    resetDraftFromVoice: !fromCard && !directive,
    progressActionKey:
      input.source.kind === "progress_card"
        ? input.source.progressActionKey
        : null,
    lane: directive
      ? "directive"
      : input.source.kind === "card_answer"
        ? "saved_card_answer"
        : "parent",
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
      modality: plan.modality,
    },
  ];
}

export interface ChatQueueFlush {
  /** The turn to send now, or null when there is nothing to say. */
  outgoing: string | null;
  /** What stays queued for the next idle line. */
  remaining: QueuedChatMessage[];
  lane: ChatSendLane;
  modality: ChatTurnModality;
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
 * Within that order, each source stays separate. A directive goes alone;
 * otherwise the flush takes the leading run from one lane. Typed messages
 * still join with typed messages, and saved card answers join only with
 * saved card answers. Mixing either pair would make the request source lie.
 */
export function flushChatQueue(
  queue: QueuedChatMessage[],
  appended?: {
    text: string;
    lane: ChatSendLane;
    modality: ChatTurnModality;
    progressActionKey?: string | null;
  },
): ChatQueueFlush {
  const all: QueuedChatMessage[] = appended
    ? [
        ...queue,
        {
          text: appended.text,
          progressActionKey: appended.progressActionKey ?? null,
          lane: appended.lane,
          modality: appended.modality,
        },
      ]
    : [...queue];
  if (all.length === 0) {
    return {
      outgoing: null,
      remaining: [],
      lane: "parent",
      modality: "text",
    };
  }

  if (all[0].lane === "directive") {
    return {
      outgoing: all[0].text,
      remaining: all.slice(1),
      lane: "directive",
      modality: "text",
    };
  }
  const lane = all[0].lane;
  let end = 0;
  while (end < all.length && all[end].lane === lane) end += 1;
  const sending = all.slice(0, end);
  return {
    outgoing: sending
      .map((entry) => entry.text)
      .join("\n\n"),
    remaining: all.slice(end),
    lane,
    modality: sending.some((entry) => entry.modality === "voice")
      ? "voice"
      : "text",
  };
}

export function prepareAttachmentChatTurn(input: {
  text: string;
  attachmentBlocks: readonly string[];
  draftFromVoice: boolean;
}): { text: string; modality: ChatTurnModality } {
  const parentText = input.text.trim();
  const modality: ChatTurnModality =
    parentText.length > 0 &&
    (input.draftFromVoice || isVoiceTranscriptionText(parentText))
      ? "voice"
      : "text";
  const markedParentText =
    modality === "voice" ? markVoiceTranscription(parentText) : parentText;
  return {
    text: [
      ...(markedParentText.length > 0 ? [markedParentText] : []),
      ...input.attachmentBlocks,
    ].join("\n\n"),
    modality,
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

/**
 * composerPrimaryAction({draft, readyAttachments}): which action owns the
 * composer's primary button right now.
 *
 * The ChatGPT composer shape (founder direction 2026-07-29): an empty box
 * offers voice, and the first character turns that same button into Send.
 * Before this, an empty box showed a disabled Send, which is a button whose
 * only job is to look unavailable.
 *
 * Extracted and tested rather than left inline because it decides which
 * action a tap in the primary slot actually performs, and getting it wrong
 * either dials a real phone when she meant to send, or hides Send when she
 * has something to say. A staged attachment counts as something to send
 * even with no words, which is how a photo with no caption goes out.
 */
export function composerPrimaryAction(input: {
  draft: string;
  readyAttachments: number;
}): "voice" | "send" {
  const hasWords = input.draft.trim().length > 0;
  return hasWords || input.readyAttachments > 0 ? "send" : "voice";
}
