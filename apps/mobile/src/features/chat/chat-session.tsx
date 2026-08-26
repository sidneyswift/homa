import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useEveAgent, type EveMessage } from "eve/react";
import { useReducedMotion } from "react-native-reanimated";
import { formatHiddenDirective } from "@homa/core";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { InlineError } from "../../components/ui/inline-error";
import {
  archiveMessages,
  foldEventsToMessages,
  pruneMessageTimes,
  saveChat,
  stampMessageTimes,
  type ArchivedMessage,
  type PreparedChat,
} from "../../lib/chat-storage";
import { buildTranscript } from "../../lib/transcript-days";
import { emitFamilyEvent } from "../../lib/events";
import { supabase } from "../../lib/supabase";
import { markTurnStarted, takeTurnLatencyMs } from "../../lib/turn-clock";
import { recoverLostTurn } from "../../lib/turn-recovery";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";
import {
  isSendLineOccupied,
  takeNextQueuedTurn,
  type ProgressDraftIntent,
  type QueuedChatMessage,
} from "./chat-send-policy";
import {
  type ComposerDraftRequest,
} from "./composer-draft";
import {
  busyLabel,
  chatCompletionAnnouncement,
  countLastTurnToolCalls,
} from "./message-utils";
import { BusyBubble, MessageView, NewReplyPill } from "./message-view";
import {
  bindProgressDraftContext,
  progressTransportForDraft,
  type ProgressDraftBinding,
} from "./progress-draft";
import { latestQuestionRequest } from "./question-card-model";
import {
  latestChecklistRequest,
  latestDetailRequest,
  latestReportReveal,
} from "./onboarding-card-model";
import { ChecklistTakeover, type ChecklistExit } from "./checklist-takeover";

/**
 * The chat surface, the mobile twin of apps/web/app/app/chat-client.tsx:
 * useEveAgent drives session state against the deployed eve routes
 * (host = EXPO_PUBLIC_API_URL); auth rides as a bearer token resolved
 * fresh per request. Homa's per-family context is injected server-side
 * on every turn, so a brand-new session already knows the family.
 *
 * One thread, fresh mornings: the transcript is one continuous history
 * under day separators while the model session rotates at the first
 * visit after 4am local (lib/chat-storage.ts). "New chat" archives the
 * visible conversation and starts a fresh session; nothing is erased.
 *
 * Never stuck (founder bug report 2026-07-10 night, web twin has the
 * full story): a backgrounded phone kills the turn stream, and a
 * half-open connection can hang without erroring, leaving the composer
 * locked. Same defenses as web: while a turn runs an empty composer
 * shows Stop and a typed one shows Stop AND Send, where Send QUEUES the
 * message for the moment the turn ends (the Claude-composer shape,
 * founder ruling 2026-07-10 night); coming back to the foreground
 * aborts a stream that has gone silent past the stall window; a
 * watchdog covers streams that die without the app ever hiding. The
 * turn is durable server-side; missed events replay from streamIndex
 * on the next send.
 *
 * Never forked (GH #170, confirmed live on the web twin, ported here
 * ahead of an incident since this app has the identical shape and a
 * dropped signal mid-turn is if anything more likely on a phone): when
 * a stream dies without a closing boundary event, eve's own client
 * wipes its local session cursor rather than keeping the id
 * (advanceSession in eve's session-utils, no fix available from here).
 * The durable turn is usually still finishing server-side regardless,
 * and lost-turn recovery below exists to find that out, but it can take
 * up to RECOVERY_DEADLINE_MS to decide. A manual send used to see no
 * session id and no "busy" status in that window and start a brand new
 * eve session, forking the conversation in two: whichever session she
 * was not looking at when its reply landed read as "my message
 * vanished". isSendLineOccupied (chat-send-policy.ts) folds `recovering`
 * into the same queue gate as `busy`, so a send during that undecided
 * window queues instead of forking, and flushQueued delivers it the
 * moment recovery settles either way.
 */

// agent.ts pins the gateway model: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

/** Where a send came from. A card tap is not typing; see sendMessage. */
type ChatSendSource = "composer" | "card" | "directive";

/** Stream reconnects per turn; matches the web twin (chat-client.tsx). */
const STREAM_RECONNECT_ATTEMPTS = 8;

/** Chat's opening prompts. Native Voice owns task-specific starter cards. */
export const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

/** A backgrounded app kills the stream within seconds; a stream this
 *  quiet when the app comes back is dead, not thinking. Exported (with
 *  the other stall constants) so the voice surface's watchdogs stay in
 *  lockstep with this file, the source of truth for the values. */
export const VISIBLE_STALL_MS = 20_000;

/** How long a just-woken app waits for the reconnecting stream to show
 *  life before giving up and aborting (the reconnect replays from
 *  streamIndex, but that round trip needs a moment). */
export const WAKE_GRACE_MS = 5_000;

/** Foreground watchdog: past the longest normal tool run (image-heavy
 *  printables stream nothing while the render runs, ~60-90s). */
export const WATCHDOG_STALL_MS = 180_000;

/** How long lost-turn recovery may keep trying before the plain error
 *  banner wins; matches the web twin. */
export const RECOVERY_DEADLINE_MS = 240_000;

function currentTimeMs(): number {
  return Date.now();
}

function apiPath(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

/**
 * The transport half of this surface's useEveAgent config: host, fresh
 * per-request bearer auth, the mobile channel header, and the reconnect
 * budget. Exported so the voice surface (features/voice/
 * use-voice-session.ts) rides the exact same authenticated channel
 * instead of drifting a second copy. Everything conversational
 * (storage, queueing, recovery bookkeeping) stays with each surface.
 */
export function buildEveTransport() {
  return {
    host: env.apiUrl,
    auth: {
      bearer: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      },
    },
    headers: EVE_CHANNEL_HEADER,
    // A phone that sleeps repeatedly through a long turn burns one
    // reconnect per wake; replay resumes from the last received event
    // (incident 2026-07-11, see web twin's header + patches/eve).
    maxReconnectAttempts: STREAM_RECONNECT_ATTEMPTS,
  };
}

export function ChatSession({
  storageKey,
  prepared,
  restoringSession,
  familyId,
  parentName,
  draftRequest,
  initialProgressChildId,
  initialProgressIntent,
  initialProgressFingerprint,
  onDraftRequestHandled,
  planWeekDraft,
  onPlanWeekDraftHandled,
}: {
  storageKey: string;
  prepared: PreparedChat;
  restoringSession: boolean;
  familyId: string | null;
  parentName: string | null;
  draftRequest: ComposerDraftRequest | null;
  initialProgressChildId: string | null;
  initialProgressIntent: ProgressDraftIntent | null;
  initialProgressFingerprint: string | null;
  onDraftRequestHandled: (requestId: string) => void;
  planWeekDraft?: ComposerDraftRequest | null;
  onPlanWeekDraftHandled?: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const stackComposer = fontScale >= 1.4;
  const messagesRef = useRef<readonly EveMessage[]>([]);
  const [archived, setArchived] = useState<ArchivedMessage[]>(prepared.archived);
  const archivedRef = useRef(archived);
  // Message id -> arrival time. State (not a ref) because the transcript
  // grouping reads it during render.
  const [liveTimes, setLiveTimes] = useState<Record<string, number>>(() => ({
    ...prepared.messageTimes,
  }));
  const reportedErrorRef = useRef<Error | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // A reply landing while she's scrolled away rereading must not yank
  // her back (Carolyng feedback, 2026-08-24): onContentSizeChange below
  // checks this ref instead of always calling scrollToEnd.
  const isNearBottomRef = useRef(true);
  const [hasNewReply, setHasNewReply] = useState(false);
  const handleTranscriptScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      const nearBottom = distanceFromBottom <= 120;
      isNearBottomRef.current = nearBottom;
      if (nearBottom) setHasNewReply(false);
    },
    [],
  );
  const composerRef = useRef<TextInput>(null);
  const userStopReasonRef = useRef<"stop" | "send-now" | null>(null);
  const turnAnnouncementSequenceRef = useRef(0);
  const [turnAnnouncement, setTurnAnnouncement] = useState<{
    message: string;
    occurrenceId: number;
  } | null>(null);
  useAccessibilityAnnouncement(
    turnAnnouncement?.message,
    turnAnnouncement?.occurrenceId,
  );
  /** Choice card partKey -> the message her taps sent from that card. */
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, string>
  >({});
  const [checklistTakeover, setChecklistTakeover] = useState<string | null>(null);
  /** Last moment the stream showed signs of life (0 = none yet). */
  const lastStreamActivityRef = useRef(0);
  /** Messages sent while a turn was running. Adjacent parent messages may
   *  batch, while hidden directives keep their own model turns. */
  const [queued, setQueued] = useState<QueuedChatMessage[]>([]);
  /** Mirrors `queued` for the recovery effect below, which can settle up
   *  to RECOVERY_DEADLINE_MS after it started and would otherwise read
   *  a stale queue captured at that effect's own last run. */
  const queuedRef = useRef<QueuedChatMessage[]>(queued);
  /** The store's send, held by ref so onFinish can deliver the queue
   *  without capturing `agent` inside its own initializer. */
  const sendRef = useRef<
    ((input: {
      message: string;
      clientContext?: QueuedChatMessage["clientContext"];
      headers?: QueuedChatMessage["headers"];
    }) => Promise<void>) | null
  >(null);
  const [draft, setDraft] = useState("");
  const [pendingProgressDraft, setPendingProgressDraft] = useState<{
    request: ComposerDraftRequest;
    childId: string;
    intent: ProgressDraftIntent;
    fingerprint: string | null;
  } | null>(null);
  const [parkedComposer, setParkedComposer] = useState<{
    draft: string;
    binding: ProgressDraftBinding | null;
  } | null>(null);
  const handledDraftRequestRef = useRef<string | null>(null);
  const handledPlanWeekDraftRef = useRef<string | null>(null);
  const progressDraftBindingRef = useRef<ProgressDraftBinding | null>(null);
  const [progressDraftBinding, setProgressDraftBindingState] =
    useState<ProgressDraftBinding | null>(null);
  const setProgressDraftBinding = useCallback(
    (binding: ProgressDraftBinding | null) => {
      progressDraftBindingRef.current = binding;
      setProgressDraftBindingState(binding);
    },
    [],
  );
  // Lost-turn recovery bookkeeping (lib/turn-recovery.ts): the durable
  // stream cursor (session streamIndex at mount + one per received
  // event, surviving storage event trimming), what the last send
  // carried, and the in-flight recovery's abort handle.
  const durableCursorRef = useRef(prepared.initialSession?.streamIndex ?? 0);
  const lastSendRef = useRef<{ text: string; atMs: number } | null>(null);
  const recoveryRef = useRef<AbortController | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (
      !draftRequest ||
      !initialProgressChildId ||
      !initialProgressIntent ||
      handledDraftRequestRef.current === draftRequest.id
    ) {
      return;
    }
    handledDraftRequestRef.current = draftRequest.id;
    const timer = setTimeout(() => {
      const incoming = {
        request: draftRequest,
        childId: initialProgressChildId,
        intent: initialProgressIntent,
        fingerprint: initialProgressFingerprint,
      };
      if (draft.trim().length > 0 || parkedComposer) {
        setPendingProgressDraft(incoming);
      } else {
        setDraft(draftRequest.text);
        setProgressDraftBinding(
          bindProgressDraftContext(
            initialProgressChildId,
            draftRequest.text,
            draftRequest.text,
            initialProgressIntent,
            initialProgressFingerprint,
          ),
        );
        setTimeout(() => composerRef.current?.focus(), 0);
      }
      onDraftRequestHandled(draftRequest.id);
    }, 0);
    return () => clearTimeout(timer);
  }, [
    draft,
    draftRequest,
    initialProgressChildId,
    initialProgressFingerprint,
    initialProgressIntent,
    onDraftRequestHandled,
    parkedComposer,
    setProgressDraftBinding,
  ]);

  // Plain composer prefill, no progress binding: this carries no child
  // or evidence for the server to verify, it is just her own opening
  // line waiting for her to send or edit. Skips silently if she is
  // already mid-draft rather than clobbering what she typed.
  useEffect(() => {
    if (
      !planWeekDraft ||
      handledPlanWeekDraftRef.current === planWeekDraft.id
    ) {
      return;
    }
    handledPlanWeekDraftRef.current = planWeekDraft.id;
    const timer = setTimeout(() => {
      if (draft.trim().length === 0 && !parkedComposer) {
        setDraft(planWeekDraft.text);
        setTimeout(() => composerRef.current?.focus(), 0);
      }
      onPlanWeekDraftHandled?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [draft, onPlanWeekDraftHandled, parkedComposer, planWeekDraft]);

  useEffect(() => {
    queuedRef.current = queued;
  }, [queued]);

  /**
   * flushQueued(): delivers the queue as the next turn, the one place
   * besides the composer's own send that starts a turn. Shared by
   * onFinish (a normal turn just ended) and lost-turn recovery's exits
   * (recovered, failed, or timed out): whichever way the line becomes
   * free again, whatever she typed while it was occupied goes out the
   * moment it is. A stable useCallback (empty deps, refs only) so the
   * recovery effect below can call it without re-running every render.
   */
  const flushQueued = useCallback(() => {
    const next = takeNextQueuedTurn(queuedRef.current);
    if (!next) return;
    queuedRef.current = next.remaining;
    setQueued(next.remaining);
    // Next tick: this can run inside the previous send's own teardown
    // (onFinish) or inside a recovery's async close-out, and eve rejects
    // overlapping sends.
    setTimeout(() => {
      lastSendRef.current = { text: next.message, atMs: currentTimeMs() };
      markTurnStarted();
      void sendRef.current?.({
        message: next.message,
        ...(next.clientContext
          ? { clientContext: next.clientContext }
          : {}),
        ...(next.headers ? { headers: next.headers } : {}),
      });
    }, 0);
  }, []);

  const emitTurnCompleted = useCallback(
    async (
      status: "ok" | "error",
      errorClass?: "turn_failed" | "send_failed" | "unknown",
    ) => {
      await emitFamilyEvent(familyId, "chat.turn_completed", {
        status,
        ...(errorClass ? { error_class: errorClass } : {}),
        modality: "text",
        latency_ms: takeTurnLatencyMs(),
        model_tier: MODEL_TIER,
        tool_calls: countLastTurnToolCalls(messagesRef.current),
      });
    },
    [familyId],
  );

  async function queueLearningReview(sessionId: string): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;
    await fetch(apiPath("/api/learning/review"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {
      // Best effort: a missed review re-arms on the next turn.
    });
  }

  const agent = useEveAgent({
    ...buildEveTransport(),
    initialEvents: prepared.initialEvents,
    initialSession: prepared.initialSession,
    onEvent() {
      lastStreamActivityRef.current = currentTimeMs();
      durableCursorRef.current += 1;
    },
    onFinish(snapshot) {
      // Stamp this turn's new message ids with the clock (the only time
      // source the transcript has; eve events carry sequence numbers,
      // not times), then persist. Callbacks refresh every render (eve's
      // hook contract), so this closure's liveTimes is current.
      const stamped = pruneMessageTimes(
        stampMessageTimes(liveTimes, snapshot.data.messages),
        snapshot.data.messages,
      );
      setLiveTimes(stamped);
      const stopped = userStopReasonRef.current;
      userStopReasonRef.current = null;
      const announcement = stopped === "send-now"
        ? "Homa stopped. Your queued message is sending now."
        : stopped === "stop"
          ? "Homa stopped. Your message draft is still here."
          : snapshot.error
            ? null
            : (chatCompletionAnnouncement(snapshot.data.messages) ?? "Homa's reply is ready.");
      if (announcement) {
        turnAnnouncementSequenceRef.current += 1;
        setTurnAnnouncement({
          message: announcement,
          occurrenceId: turnAnnouncementSequenceRef.current,
        });
        if (!isNearBottomRef.current) setHasNewReply(true);
      }
      void saveChat(storageKey, {
        archived: archivedRef.current,
        events: snapshot.events,
        session: snapshot.session,
        messageTimes: stamped,
        lastActivityAt: currentTimeMs(),
      });
      // onFinish fires for failed turns too; those already emit their
      // own error event (the agent.error effect), so an unconditional
      // "ok" here double-counted every failure (seen live 2026-07-11).
      if (!snapshot.error) void emitTurnCompleted("ok");
      const sessionId = snapshot.session?.sessionId;
      if (!snapshot.error && familyId && sessionId) {
        void queueLearningReview(sessionId);
      }
      // Deliver the queue: messages she sent while Homa was working go
      // out as ONE follow-up turn the moment the line is free (also
      // after Stop, which is often pressed exactly to jump the line).
      // A failed turn holds the queue; her next manual send carries it.
      if (!snapshot.error) flushQueued();
    },
  });
  const agentError = agent.error;
  const agentReset = agent.reset;
  const agentSend = agent.send;
  const agentStop = agent.stop;

  useEffect(() => {
    sendRef.current = agentSend;
  }, [agentSend]);

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;

  function stopForUser(reason: "stop" | "send-now"): void {
    userStopReasonRef.current = reason;
    agentStop();
  }

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    archivedRef.current = archived;
  }, [archived]);

  useEffect(() => {
    if (!agentError || agentError === reportedErrorRef.current) return;
    reportedErrorRef.current = agentError;
    void emitTurnCompleted("error", "turn_failed");

    // Lost-turn recovery: the durable run usually outlives a dead
    // stream, so before leaving her with the error banner, replay the
    // session server-side and fold the finished conversation, reply
    // included, back into the transcript (web twin has the full story).
    //
    // Session-fork fix (GH #170, confirmed live on web, ported here
    // ahead of an incident): a manual send used to stand down a running
    // recovery and send on whatever session state was left, which had
    // no session id (eve wipes its cursor the moment the stream dies
    // without a closing boundary event). That raced the durable old
    // turn, still finishing server-side, into a second, unrelated eve
    // session for the same family. sendMessage now queues instead of
    // forking while this effect is undecided (isSendLineOccupied in
    // chat-send-policy.ts), and flushQueued below delivers whatever she
    // typed the moment recovery settles, on every exit.
    const lastSend = lastSendRef.current;
    if (!lastSend || recoveryRef.current) return;
    const controller = new AbortController();
    recoveryRef.current = controller;
    const deadline = setTimeout(() => controller.abort(), RECOVERY_DEADLINE_MS);
    setRecovering(true);
    void (async () => {
      const recovered = await recoverLostTurn({
        supabase,
        sentText: lastSend.text,
        sentAtMs: lastSend.atMs,
        minBoundaryIndex: durableCursorRef.current,
        host: env.apiUrl,
        bearer: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? "";
        },
        signal: controller.signal,
      });
      clearTimeout(deadline);
      if (recoveryRef.current === controller) recoveryRef.current = null;
      if (controller.signal.aborted) {
        setRecovering(false);
        // Gave up without an answer: the same fresh-session fallback a
        // failed recovery gets below, so whatever she typed while
        // waiting still goes out instead of racing a fresh session on
        // her next manual send.
        flushQueued();
        return;
      }
      if (recovered) {
        // The "New chat" move done for her: the whole recovered session
        // folds into the archive (reply included), the store starts
        // clean, and the error clears with it. Nothing is lost.
        const recoveredMessages = foldEventsToMessages(recovered.events);
        const stamped = stampMessageTimes(liveTimes, recoveredMessages);
        const nextArchived = [
          ...archivedRef.current,
          ...archiveMessages(recoveredMessages, stamped),
        ];
        setArchived(nextArchived);
        archivedRef.current = nextArchived;
        setLiveTimes({});
        setQuestionAnswers({});
        void saveChat(storageKey, {
          archived: nextArchived,
          events: [],
          session: undefined,
          messageTimes: {},
          lastActivityAt: currentTimeMs(),
        });
        agentReset();
        durableCursorRef.current = 0;
        lastSendRef.current = null;
      }
      setRecovering(false);
      // Whichever way it resolved, the line is free again: send anything
      // she typed while it was undecided (a fresh session either way,
      // since eve already wiped this one's session id when the stream
      // died, or agentReset just did on a clean recovery above).
      flushQueued();
    })();
  }, [agentError, agentReset, emitTurnCompleted, flushQueued, liveTimes, storageKey]);

  // Give up a running recovery when the chat unmounts.
  useEffect(() => {
    return () => recoveryRef.current?.abort();
  }, []);

  // Dead-stream recovery: abort a stream that has clearly stopped
  // flowing so the composer never locks. stop() flips status back to
  // ready; the durable turn continues server-side and its events replay
  // from streamIndex on the next send. Since the stream reconnects on
  // its own (patched disconnect classifier + maxReconnectAttempts), a
  // just-woken app first gets a grace window: if the reconnect delivers
  // any event, the turn is alive and nothing aborts.
  useEffect(() => {
    if (!busy) return;
    // The turn just started; that counts as activity (the stall clock
    // must never inherit a stamp from a previous turn).
    lastStreamActivityRef.current = currentTimeMs();
    let wakeGraceTimer: ReturnType<typeof setTimeout> | null = null;
    const isStale = (stallMs: number) =>
      currentTimeMs() - lastStreamActivityRef.current > stallMs;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!isStale(VISIBLE_STALL_MS) || wakeGraceTimer !== null) return;
      wakeGraceTimer = setTimeout(() => {
        wakeGraceTimer = null;
        // Still nothing after the grace: the stream really is dead.
        if (isStale(VISIBLE_STALL_MS)) agentStop();
      }, WAKE_GRACE_MS);
    });
    const watchdog = setInterval(() => {
      if (isStale(WATCHDOG_STALL_MS)) agentStop();
    }, 15_000);
    return () => {
      subscription.remove();
      clearInterval(watchdog);
      if (wakeGraceTimer !== null) clearTimeout(wakeGraceTimer);
    };
  }, [agentStop, busy]);

  function updateDraft(next: string): void {
    setDraft(next);
  }

  function sendMessage(text: string, source: ChatSendSource = "composer") {
    const message = text.trim();
    if (message.length === 0) return;
    // A tap on a card is not typing, so it leaves whatever she had
    // half-written in the composer alone (the web twin's send policy,
    // apps/web/app/app/chat-send-policy.ts).
    const progressTransport = progressTransportForDraft(
      progressDraftBindingRef.current,
      text,
    );
    const composerTransport = source === "composer" ? progressTransport : null;
    const queuedMessage: QueuedChatMessage = {
      text: message,
      lane: source === "directive" ? "directive" : "parent",
      ...(composerTransport ?? {}),
    };
    // Sending mid-turn queues instead of refusing (texting model,
    // founder ruling 2026-07-10 night): the bubble waits by the
    // composer and goes out the moment the line is free. Occupied by an
    // active stream OR by lost-turn recovery still deciding whether the
    // previous, interrupted turn already finished (chat-send-policy.ts's
    // isSendLineOccupied; GH #170). Either way a send here must queue,
    // never start a second eve session racing the one that might still
    // be finishing.
    if (restoringSession || isSendLineOccupied({ busy, recovering })) {
      // No session identity exists to queue against until restoration
      // settles. Keep the composer's text intact and do not mint a fork.
      if (restoringSession) return;
      // A tap on a card is not typing, so it leaves whatever she had
      // half-written in the composer alone.
      if (source === "composer") {
        releaseComposerAfterSend();
      }
      setQueued((current) => {
        const next = [...current, queuedMessage];
        queuedRef.current = next;
        return next;
      });
      return;
    }
    if (source === "composer") {
      releaseComposerAfterSend();
    }
    // Reaching here means the line reads as free (not busy, not
    // recovering), so any recovery handle left over is already spent or
    // is the vanishingly small same-tick race between an error landing
    // and its `recovering` state committing; abort is a defensive no-op
    // in the ordinary case, not the mechanism that keeps sends from
    // forking a session anymore (see isSendLineOccupied above).
    recoveryRef.current?.abort();
    // A fresh session (first turn, or the reset after a failed one)
    // restarts the durable event cursor.
    if (!agent.session?.sessionId) durableCursorRef.current = 0;
    // A queue held back by a failed turn rides along with the next
    // manual send, in the order she wrote everything.
    const next = takeNextQueuedTurn([...queuedRef.current, queuedMessage]);
    if (!next) return;
    queuedRef.current = next.remaining;
    setQueued(next.remaining);
    lastSendRef.current = { text: next.message, atMs: currentTimeMs() };
    markTurnStarted();
    void agent.send({
      message: next.message,
      ...(next.clientContext
        ? { clientContext: next.clientContext }
        : {}),
      ...(next.headers ? { headers: next.headers } : {}),
    });
  }

  function releaseComposerAfterSend(): void {
    if (parkedComposer) {
      setDraft(parkedComposer.draft);
      setProgressDraftBinding(parkedComposer.binding);
      setParkedComposer(null);
      return;
    }
    setDraft("");
    setProgressDraftBinding(null);
  }

  function usePendingProgressDraft(): void {
    if (!pendingProgressDraft) return;
    setParkedComposer({
      draft,
      binding: progressDraftBindingRef.current,
    });
    setDraft(pendingProgressDraft.request.text);
    setProgressDraftBinding(
      bindProgressDraftContext(
        pendingProgressDraft.childId,
        pendingProgressDraft.request.text,
        pendingProgressDraft.request.text,
        pendingProgressDraft.intent,
        pendingProgressDraft.fingerprint,
      ),
    );
    setPendingProgressDraft(null);
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function restoreParkedComposer(): void {
    if (!parkedComposer) return;
    setDraft(parkedComposer.draft);
    setProgressDraftBinding(parkedComposer.binding);
    setParkedComposer(null);
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function focusComposer() {
    composerRef.current?.focus();
  }

  /**
   * A finished choice card sends its answers as ONE ordinary message.
   * The card then reads past tense, so a spent option never looks
   * pressable.
   */
  function sendQuestionCardAnswers(partKey: string, text: string) {
    if (text.trim().length === 0) {
      // Nothing to say, so say nothing and give her the composer
      // instead of sending an empty turn.
      focusComposer();
      return;
    }
    sendMessage(text, "card");
    setQuestionAnswers((current) => ({ ...current, [partKey]: text }));
  }

  /**
   * The retry affordance on a "Not sent" bubble (web twin's part 2 of
   * GH #170: a dropped connection used to erase her words with nothing
   * on screen to say so). Not a composer send, so it leaves whatever she
   * is mid-typing untouched, and it resends the failed bubble's exact
   * words. sendMessage's own isSendLineOccupied gate already keeps this
   * from forking a session if a recovery for the earlier failure happens
   * to still be running, and queues it instead, same as anything else
   * typed in that window.
   */
  function retryFailedMessage(text: string): void {
    sendMessage(text, "card");
  }

  function detailsSaved(summary: string): void {
    sendMessage(formatHiddenDirective("details_saved", { summary }), "directive");
  }

  function closeChecklist(exit: ChecklistExit | null): void {
    setChecklistTakeover(null);
    if (!exit) return;
    sendMessage(
      formatHiddenDirective("checklist_complete", {
        childId: exit.childId,
        answered: exit.answered,
        remaining: exit.remaining,
        complete: exit.complete ? 1 : 0,
      }),
      "directive",
    );
  }

  const transcript = buildTranscript({
    archived,
    live: messages,
    liveTimes,
  });
  const hasAnyMessages = transcript.some((item) => item.kind === "message");
  // The live choice card, if any: only the newest unanswered card takes
  // taps, and only while the line is free. Identity, not message id,
  // because eve ids restart with each session and the archive above can
  // hold a card whose id matches this one's.
  const liveMessageSet = new Set(messages);
  const activeQuestion = busy || restoringSession ? null : latestQuestionRequest(messages);
  const activeChecklist = busy || restoringSession ? null : latestChecklistRequest(messages);
  const activeDetail = busy || restoringSession ? null : latestDetailRequest(messages);
  const activeReport = busy || restoringSession ? null : latestReportReveal(messages);
  // The chips return whenever a session has no words in it yet: the
  // first run, or a fresh morning over yesterday's scrollback.
  const showSuggestions = messages.length === 0 && !busy && !restoringSession;

  const statusLabel = busy ? busyLabel(messages) : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: space.md,
          gap: space.md,
          flexGrow: 1,
        }}
        onContentSizeChange={() => {
          if (isNearBottomRef.current) {
            scrollRef.current?.scrollToEnd({ animated: !reducedMotion });
          }
        }}
        onScroll={handleTranscriptScroll}
        scrollEventThrottle={100}
        keyboardShouldPersistTaps="handled"
      >
        {!hasAnyMessages ? (
          <View style={{ flex: 1, justifyContent: "center", gap: space.sm }}>
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.xl,
                color: colors.textStrong,
              }}
            >
              {parentName ? `Hi ${parentName}, I'm Homa.` : "Hi, I'm Homa."}
            </Text>
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              Ask me anything about your homeschool day.
            </Text>
            <View
              style={{
                marginTop: space.md,
                gap: space.sm,
                alignItems: "center",
              }}
            >
              {showSuggestions
                ? SUGGESTIONS.map((suggestion) => (
                    <SuggestionChip
                      key={suggestion}
                      label={suggestion}
                      onPress={() => sendMessage(suggestion, "card")}
                    />
                  ))
                : null}
            </View>
          </View>
        ) : (
          <>
            {transcript.map((item) =>
              item.kind === "separator" ? (
                <DaySeparator key={item.key} label={item.label} />
              ) : (
                <MessageView
                  key={item.key}
                  message={item.message}
                  onRetryFailedMessage={
                    liveMessageSet.has(item.message)
                      ? retryFailedMessage
                      : undefined
                  }
                  questions={{
                    activeQuestionPartKey: liveMessageSet.has(item.message)
                      ? activeQuestion?.partKey
                      : undefined,
                    onSendQuestionAnswers: activeQuestion
                      ? (text) =>
                          sendQuestionCardAnswers(activeQuestion.partKey, text)
                      : undefined,
                    onQuestionTypeInstead: focusComposer,
                    questionAnswers,
                  }}
                  onboarding={{
                    activeChecklistPartKey: liveMessageSet.has(item.message)
                      ? activeChecklist?.partKey
                      : undefined,
                    activeDetailPartKey: liveMessageSet.has(item.message)
                      ? activeDetail?.partKey
                      : undefined,
                    activeReportPartKey: liveMessageSet.has(item.message)
                      ? activeReport?.partKey
                      : undefined,
                    onOpenChecklist: activeChecklist
                      ? setChecklistTakeover
                      : undefined,
                    onDetailsSaved: activeDetail ? detailsSaved : undefined,
                  }}
                />
              ),
            )}
            {showSuggestions ? (
              <View
                style={{
                  marginTop: space.sm,
                  gap: space.sm,
                  alignItems: "center",
                }}
              >
                {SUGGESTIONS.map((suggestion) => (
                  <SuggestionChip
                    key={suggestion}
                    label={suggestion}
                    onPress={() => sendMessage(suggestion, "card")}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
        {statusLabel ? <BusyBubble label={statusLabel} /> : null}
        {queued.some((entry) => entry.lane === "parent") ? (
          // Messages sent mid-turn wait here as dimmed bubbles and go
          // out on turn end; the remove button pulls one back first.
          <View style={{ alignItems: "flex-end", gap: space.sm }}>
            {queued.map((entry, index) => entry.lane === "parent" ? (
              <View
                key={`${index}:${entry.text.slice(0, 24)}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  maxWidth: "76%",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove queued message: ${entry.text}`}
                  onPress={() =>
                    setQueued((current) => {
                      const next = current.filter((_, at) => at !== index);
                      queuedRef.current = next;
                      return next;
                    })
                  }
                  style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodySemibold,
                      fontSize: fontSize.sm,
                      color: colors.textMuted,
                    }}
                  >
                    {"\u2715"}
                  </Text>
                </Pressable>
                <View
                  style={{
                    borderRadius: radius.lg,
                    borderBottomRightRadius: radius.sm,
                    backgroundColor: colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.brandHover,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.body,
                      fontSize: fontSize.base,
                      color: colors.textStrong,
                    }}
                  >
                    {entry.text}
                  </Text>
                </View>
              </View>
            ) : null)}
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.xs,
                  color: colors.textMuted,
                }}
              >
                Sends when Homa finishes
              </Text>
              {busy ? (
                // "Send now" interrupts: stopping the turn is all it
                // takes, the flush in onFinish delivers the queue the
                // moment the abort settles.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Stop Homa and send the queued message now"
                  onPress={() => stopForUser("send-now")}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodySemibold,
                      fontSize: fontSize.xs,
                      color: colors.textStrong,
                      textDecorationLine: "underline",
                    }}
                  >
                    Send now
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {recovering || restoringSession ? (
          // The stream died but the turn is durable server-side; while
          // the replay runs, the wait reads as work, not as a failure.
          <BusyBubble
            label={recovering ? "Reconnecting\u2026" : "Restoring conversation\u2026"}
          />
        ) : agent.error ? (
          <InlineError message="Your conversation is safe; that last message didn't go through. Try sending it again." />
        ) : null}
      </ScrollView>

      {hasNewReply && turnAnnouncement ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, alignItems: "center" }}>
          <NewReplyPill
            label={turnAnnouncement.message}
            onPress={() => {
              setHasNewReply(false);
              scrollRef.current?.scrollToEnd({ animated: !reducedMotion });
            }}
          />
        </View>
      ) : null}

      {checklistTakeover ? (
        <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.page }}>
          <ChecklistTakeover childId={checklistTakeover} onClose={closeChecklist} />
        </View>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.page }}>
        {pendingProgressDraft ? (
          <ProgressDraftChoice
            intent={pendingProgressDraft.intent}
            onUse={usePendingProgressDraft}
            onKeep={() => setPendingProgressDraft(null)}
          />
        ) : parkedComposer ? (
          <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
            <Text style={{ flex: 1, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textBody }}>
              Your earlier draft is safe.
            </Text>
            <Pressable accessibilityRole="button" onPress={restoreParkedComposer} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
                Back to my draft
              </Text>
            </Pressable>
          </View>
        ) : null}
        {progressDraftBinding ? (
          <View
            style={{
              paddingHorizontal: space.md,
              paddingTop: space.sm,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: space.sm,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.xs,
                  color: colors.textStrong,
                }}
              >
                {progressDraftBinding.intent === "review_progress_next_move"
                  ? "Progress move attached"
                  : "Progress context attached"}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.xs,
                  color: colors.textBody,
                }}
              >
                Edit anything. Homa will keep the right Progress context when you send.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove Progress context"
              accessibilityHint="Keeps your words and removes the attached Progress details."
              onPress={() => setProgressDraftBinding(null)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: space.sm,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.sm,
                  color: colors.textStrong,
                }}
              >
                Remove context
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: stackComposer ? "column" : "row",
            alignItems: stackComposer ? "stretch" : "flex-end",
            gap: space.sm,
            padding: space.md,
          }}
        >
        <TextInput
          ref={composerRef}
          value={draft}
          onChangeText={updateDraft}
          accessibilityLabel="Message Homa"
          placeholder={"Tell Homa about your day\u2026"}
          placeholderTextColor={colors.textMuted}
          multiline
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={() => sendMessage(draft)}
          style={{
            flex: stackComposer ? undefined : 1,
            width: stackComposer ? "100%" : undefined,
            minHeight: 48,
            maxHeight: 128,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 20,
            paddingVertical: 12,
            textAlignVertical: "top",
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textStrong,
          }}
        />
        {/* The Claude-composer shape (founder ruling 2026-07-10 night):
            while Homa works, an empty composer shows Stop; a typed one
            shows Stop AND Send, where Send queues the message for the
            moment the turn ends. Idle shows Send. */}
        {busy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop Homa's response"
            onPress={() => stopForUser("stop")}
            style={({ pressed }) => ({
              minHeight: 48,
              alignSelf: stackComposer ? "stretch" : "auto",
              borderRadius: radius.pill,
              borderWidth: draft.trim().length > 0 ? 1 : 0,
              borderColor: pressed ? colors.brand : colors.border,
              backgroundColor:
                draft.trim().length > 0
                  ? colors.card
                  : pressed
                    ? colors.brandHover
                    : colors.brandHover,
              paddingHorizontal: space.lg,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.base,
                color: draft.trim().length > 0 ? colors.textStrong : colors.onBrand,
              }}
            >
              Stop
            </Text>
          </Pressable>
        ) : null}
        {!busy || draft.trim().length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? "Queue message to send when Homa finishes" : "Send message to Homa"}
            accessibilityState={{ disabled: restoringSession || draft.trim().length === 0 }}
            onPress={() => sendMessage(draft)}
            disabled={restoringSession || draft.trim().length === 0}
            style={({ pressed }) => ({
              minHeight: 48,
              alignSelf: stackComposer ? "stretch" : "auto",
              borderRadius: radius.pill,
              backgroundColor: colors.brandHover,
              paddingHorizontal: space.lg,
              alignItems: "center",
              justifyContent: "center",
              opacity: restoringSession || draft.trim().length === 0 ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.base,
                color: colors.onBrand,
              }}
            >
              Send
            </Text>
          </Pressable>
        ) : null}
        </View>
        </View>
      )}
    </View>
  );
}

function ProgressDraftChoice({
  intent,
  onUse,
  onKeep,
}: {
  intent: ProgressDraftIntent;
  onUse: () => void;
  onKeep: () => void;
}) {
  useAccessibilityAnnouncement(
    "You already have a draft. Keep it, or set it aside while you talk through this Progress idea.",
  );
  return (
    <View
      style={{
        margin: space.md,
        marginBottom: 0,
        padding: space.md,
        gap: space.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.brandSoft,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
        You already have a draft
      </Text>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
        Keep it, or set it aside while you talk through this Progress idea.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Pressable accessibilityRole="button" onPress={onUse} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.brandHover }}>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.onBrand }}>
            {intent === "review_progress_next_move" ? "Use next move" : "Use Progress prompt"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onKeep} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.md }}>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
            Keep my draft
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SuggestionChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: pressed ? colors.brand : colors.border,
        backgroundColor: colors.card,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        transform: [{ scale: pressed && !reducedMotion ? pressScale : 1 }],
      })}
    >
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textStrong,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The Slack-style date rule: a quiet centered label between days, so
 *  the past reads as the past without a card or a banner. */
function DaySeparator({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.xs,
          color: colors.textMuted,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
    </View>
  );
}
