import { isHiddenDirective } from "../../lib/onboarding/directives";

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
 * Which lane a queued message rides in. Directives never string-join
 * with the parent's words: a machine sentence glued onto the front of
 * what she was typing arrives wearing her voice, and the model answers
 * a sentence nobody wrote.
 */
export type ChatSendLane = "parent" | "directive";

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

/**
 * What the client does when lost-turn recovery hits its deadline without
 * an answer.
 *
 * - "flush": send what she typed now. This is today's behaviour
 *   (chat-client.tsx, the aborted branch). It sends with no session id, so
 *   if the old turn is still alive server-side it forks the session, and
 *   the fork is what reads to her as "my message disappeared".
 * - "hold": leave it queued. The queue UI already offers "Send now", so
 *   nothing is lost, but nothing goes out until she taps or the line
 *   settles.
 * - "keep-waiting": the interrupted turn is probably still building, so
 *   extend rather than give up.
 */
export type RecoveryTimeoutAction = "flush" | "hold" | "keep-waiting";

/**
 * actionOnRecoveryTimeout(...): the residual half of GH #170.
 *
 * isSendLineOccupied above closes the fork while `recovering` is true.
 * This decides what happens the moment recovering goes false on a
 * timeout, which is the window PR #227 did not cover.
 *
 * Measured on the co-founder family 2026-07-27, and the reason this is
 * not theoretical: RECOVERY_DEADLINE_MS is 240_000, sized for "the
 * longest normal turn with slack". Her real web turns ran to 780s, and
 * every materials build took 3.5 to 13 minutes. Her 03:29:54Z message
 * got no reply, she waited 390s (past the 240s deadline, so recovery had
 * already given up and flushed), sent again at 03:36:24Z into a brand new
 * session, and the reply to the first message landed at 03:38:26Z in the
 * session she had abandoned. That is the literal shape of "i have asked
 * her about things multiple times and it doesnt show up in our chat".
 *
 * TODO(founder call): implement the policy. The trade-off is whose time
 * gets protected. "flush" keeps her message moving but can split the
 * conversation in two. "hold" never forks but can leave her staring at an
 * unsent bubble after a 4-minute wait. "keep-waiting" is honest about a
 * build that really is still running, at the cost of a longer
 * "Reconnecting..." banner. A build-aware answer is allowed to mix them.
 */
export function actionOnRecoveryTimeout(_input: {
  /** Milliseconds since the interrupted turn started. */
  elapsedMs: number;
  /**
   * Whether the last thing seen in flight was a long build (a printable
   * or a plan). These are the turns that outlive the deadline.
   */
  longBuildInFlight: boolean;
  /** How many of her messages are waiting to go out. */
  queuedCount: number;
}): RecoveryTimeoutAction {
  throw new Error("actionOnRecoveryTimeout is not implemented yet");
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
    input.source.kind === "progress_card" ||
    input.source.kind === "question_card" ||
    input.source.kind === "card_answer";
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
