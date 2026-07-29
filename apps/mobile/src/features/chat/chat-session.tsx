import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEveAgent, type EveMessage } from "eve/react";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
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
import { isSendLineOccupied } from "./chat-send-policy";
import { busyLabel, countLastTurnToolCalls } from "./message-utils";
import { BusyBubble, MessageView } from "./message-view";
import { latestQuestionRequest } from "./question-card-model";

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
type ChatSendSource = "composer" | "card";

/** Stream reconnects per turn; matches the web twin (chat-client.tsx). */
const STREAM_RECONNECT_ATTEMPTS = 8;

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

/** A backgrounded app kills the stream within seconds; a stream this
 *  quiet when the app comes back is dead, not thinking. */
const VISIBLE_STALL_MS = 20_000;

/** How long a just-woken app waits for the reconnecting stream to show
 *  life before giving up and aborting (the reconnect replays from
 *  streamIndex, but that round trip needs a moment). */
const WAKE_GRACE_MS = 5_000;

/** Foreground watchdog: past the longest normal tool run (image-heavy
 *  printables stream nothing while the render runs, ~60-90s). */
const WATCHDOG_STALL_MS = 180_000;

/** How long lost-turn recovery may keep trying before the plain error
 *  banner wins; matches the web twin. */
const RECOVERY_DEADLINE_MS = 240_000;

function currentTimeMs(): number {
  return Date.now();
}

function apiPath(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

export function ChatSession({
  storageKey,
  prepared,
  familyId,
  parentName,
}: {
  storageKey: string;
  prepared: PreparedChat;
  familyId: string | null;
  parentName: string | null;
}) {
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
  const composerRef = useRef<TextInput>(null);
  /** Choice card partKey -> the message her taps sent from that card. */
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, string>
  >({});
  /** Last moment the stream showed signs of life (0 = none yet). */
  const lastStreamActivityRef = useRef(0);
  /** Messages sent while a turn was running; flushed as one message the
   *  moment the line is free. */
  const [queued, setQueued] = useState<string[]>([]);
  /** Mirrors `queued` for the recovery effect below, which can settle up
   *  to RECOVERY_DEADLINE_MS after it started and would otherwise read
   *  a stale queue captured at that effect's own last run. */
  const queuedRef = useRef<string[]>(queued);
  /** The store's send, held by ref so onFinish can deliver the queue
   *  without capturing `agent` inside its own initializer. */
  const sendRef = useRef<((input: { message: string }) => Promise<void>) | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  // Lost-turn recovery bookkeeping (lib/turn-recovery.ts): the durable
  // stream cursor (session streamIndex at mount + one per received
  // event, surviving storage event trimming), what the last send
  // carried, and the in-flight recovery's abort handle.
  const durableCursorRef = useRef(prepared.initialSession?.streamIndex ?? 0);
  const lastSendRef = useRef<{ text: string; atMs: number } | null>(null);
  const recoveryRef = useRef<AbortController | null>(null);
  const [recovering, setRecovering] = useState(false);

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
    if (queuedRef.current.length === 0) return;
    const message = queuedRef.current.join("\n\n");
    setQueued([]);
    // Next tick: this can run inside the previous send's own teardown
    // (onFinish) or inside a recovery's async close-out, and eve rejects
    // overlapping sends.
    setTimeout(() => {
      lastSendRef.current = { text: message, atMs: currentTimeMs() };
      markTurnStarted();
      void sendRef.current?.({ message });
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

  function sendMessage(text: string, source: ChatSendSource = "composer") {
    const message = text.trim();
    if (message.length === 0) return;
    // A tap on a card is not typing, so it leaves whatever she had
    // half-written in the composer alone (the web twin's send policy,
    // apps/web/app/app/chat-send-policy.ts).
    if (source === "composer") setDraft("");
    // Sending mid-turn queues instead of refusing (texting model,
    // founder ruling 2026-07-10 night): the bubble waits by the
    // composer and goes out the moment the line is free. Occupied by an
    // active stream OR by lost-turn recovery still deciding whether the
    // previous, interrupted turn already finished (chat-send-policy.ts's
    // isSendLineOccupied; GH #170). Either way a send here must queue,
    // never start a second eve session racing the one that might still
    // be finishing.
    if (isSendLineOccupied({ busy, recovering })) {
      setQueued((current) => [...current, message]);
      return;
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
    const outgoing = [...queued, message].join("\n\n");
    setQueued([]);
    lastSendRef.current = { text: outgoing, atMs: currentTimeMs() };
    markTurnStarted();
    void agent.send({ message: outgoing });
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

  /** The manual fresh start: archive what is on screen, rotate the
   *  session, keep every word visible above. Nothing is erased. */
  function startNewChat() {
    recoveryRef.current?.abort();
    const nextArchived = [
      ...archivedRef.current,
      ...archiveMessages(messages, stampMessageTimes(liveTimes, messages)),
    ];
    setArchived(nextArchived);
    archivedRef.current = nextArchived;
    setLiveTimes({});
    setQueued([]);
    // The answered-card summaries belong to the session that just went
    // to the archive; the archived cards render settled on their own.
    setQuestionAnswers({});
    void saveChat(storageKey, {
      archived: nextArchived,
      events: [],
      session: undefined,
      messageTimes: {},
      lastActivityAt: currentTimeMs(),
    });
    agent.reset();
    durableCursorRef.current = 0;
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
  const activeQuestion = busy ? null : latestQuestionRequest(messages);
  // The chips return whenever a session has no words in it yet: the
  // first run, a fresh morning over yesterday's scrollback, and right
  // after "Start a new chat".
  const showSuggestions = messages.length === 0 && !busy;

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
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
              {SUGGESTIONS.map((suggestion) => (
                <SuggestionChip
                  key={suggestion}
                  label={suggestion}
                  onPress={() => sendMessage(suggestion)}
                />
              ))}
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
                    onPress={() => sendMessage(suggestion)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
        {statusLabel ? <BusyBubble label={statusLabel} /> : null}
        {queued.length > 0 ? (
          // Messages sent mid-turn wait here as dimmed bubbles and go
          // out on turn end; the remove button pulls one back first.
          <View style={{ alignItems: "flex-end", gap: space.sm }}>
            {queued.map((text, index) => (
              <View
                key={`${index}:${text.slice(0, 24)}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  maxWidth: "76%",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove from queue"
                  onPress={() =>
                    setQueued((current) => current.filter((_, at) => at !== index))
                  }
                  hitSlop={8}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodySemibold,
                      fontSize: fontSize.sm,
                      color: colors.textSubtle,
                    }}
                  >
                    {"\u2715"}
                  </Text>
                </Pressable>
                <View
                  style={{
                    borderRadius: radius.lg,
                    borderBottomRightRadius: radius.sm,
                    backgroundColor: colors.brand,
                    opacity: 0.7,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.body,
                      fontSize: fontSize.base,
                      color: colors.onBrand,
                    }}
                  >
                    {text}
                  </Text>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.xs,
                  color: colors.textSubtle,
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
                  onPress={() => agent.stop()}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodySemibold,
                      fontSize: fontSize.xs,
                      color: colors.brand,
                    }}
                  >
                    Send now
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {recovering ? (
          // The stream died but the turn is durable server-side; while
          // the replay runs, the wait reads as work, not as a failure.
          <BusyBubble label={"Reconnecting\u2026"} />
        ) : agent.error ? (
          <Text
            accessibilityRole="alert"
            style={{
              textAlign: "center",
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.danger,
            }}
          >
            {
              "Your conversation is safe; that last message didn't go through. Try sending it again."
            }
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: space.sm,
          padding: space.md,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          backgroundColor: colors.card,
        }}
      >
        <TextInput
          ref={composerRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={"Tell Homa about your day\u2026"}
          placeholderTextColor={colors.textSubtle}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(draft)}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 20,
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
            accessibilityLabel="Stop"
            onPress={() => agent.stop()}
            style={({ pressed }) => ({
              minHeight: 48,
              borderRadius: radius.pill,
              borderWidth: draft.trim().length > 0 ? 1 : 0,
              borderColor: pressed ? colors.brand : colors.border,
              backgroundColor:
                draft.trim().length > 0
                  ? colors.card
                  : pressed
                    ? colors.brandHover
                    : colors.brand,
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
            accessibilityLabel="Send"
            onPress={() => sendMessage(draft)}
            disabled={draft.trim().length === 0}
            style={({ pressed }) => ({
              minHeight: 48,
              borderRadius: radius.pill,
              backgroundColor: pressed ? colors.brandHover : colors.brand,
              paddingHorizontal: space.lg,
              alignItems: "center",
              justifyContent: "center",
              opacity: draft.trim().length === 0 ? 0.6 : 1,
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
      {messages.length > 0 ? (
        <NewChatRow disabled={busy} onPress={startNewChat} />
      ) : null}
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: pressed ? colors.brand : colors.border,
        backgroundColor: colors.card,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        transform: [{ scale: pressed ? pressScale : 1 }],
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
          color: colors.textSubtle,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
    </View>
  );
}

function NewChatRow({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        paddingBottom: space.sm,
        alignItems: "center",
      }}
    >
      <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}>
        <Text
          style={{
            fontFamily: fontFamilies.bodyMedium,
            fontSize: fontSize.sm,
            color: disabled ? colors.textSubtle : colors.textMuted,
          }}
        >
          Start a new chat
        </Text>
      </Pressable>
    </View>
  );
}
