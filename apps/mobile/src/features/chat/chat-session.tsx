import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEveAgent, type EveMessage } from "eve/react";

import { env } from "../../lib/env";
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
import { busyLabel, countLastTurnToolCalls } from "./message-utils";
import { BusyBubble, MessageView } from "./message-view";

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
 */

// agent.ts pins the gateway model: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

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
  /** Last moment the stream showed signs of life (0 = none yet). */
  const lastStreamActivityRef = useRef(0);
  /** Messages sent while a turn was running; flushed as one message the
   *  moment the line is free. */
  const [queued, setQueued] = useState<string[]>([]);
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

  async function emitTurnCompleted(
    status: "ok" | "error",
    errorClass?: "turn_failed" | "send_failed" | "unknown",
  ) {
    await emitFamilyEvent(familyId, "chat.turn_completed", {
      status,
      ...(errorClass ? { error_class: errorClass } : {}),
      modality: "text",
      latency_ms: takeTurnLatencyMs(),
      model_tier: MODEL_TIER,
      tool_calls: countLastTurnToolCalls(messagesRef.current),
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
    // A phone that sleeps repeatedly through a long turn burns one
    // reconnect per wake; replay resumes from the last received event
    // (incident 2026-07-11, see web twin's header + patches/eve).
    maxReconnectAttempts: STREAM_RECONNECT_ATTEMPTS,
    initialEvents: prepared.initialEvents,
    initialSession: prepared.initialSession,
    onEvent() {
      lastStreamActivityRef.current = Date.now();
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
        lastActivityAt: Date.now(),
      });
      // onFinish fires for failed turns too; those already emit their
      // own error event (the agent.error effect), so an unconditional
      // "ok" here double-counted every failure (seen live 2026-07-11).
      if (!snapshot.error) void emitTurnCompleted("ok");
      // Deliver the queue: messages she sent while Homa was working go
      // out as ONE follow-up turn the moment the line is free (also
      // after Stop, which is often pressed exactly to jump the line).
      // A failed turn holds the queue; her next manual send carries it.
      if (!snapshot.error && queued.length > 0) {
        const message = queued.join("\n\n");
        setQueued([]);
        // Next tick: this callback runs inside the previous send's
        // teardown, and eve rejects overlapping sends.
        setTimeout(() => {
          lastSendRef.current = { text: message, atMs: Date.now() };
          markTurnStarted();
          void sendRef.current?.({ message });
        }, 0);
      }
    },
  });

  useEffect(() => {
    sendRef.current = agent.send;
  }, [agent.send]);

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    archivedRef.current = archived;
  }, [archived]);

  useEffect(() => {
    if (!agent.error || agent.error === reportedErrorRef.current) return;
    reportedErrorRef.current = agent.error;
    void emitTurnCompleted("error", "turn_failed");

    // Lost-turn recovery: the durable run usually outlives a dead
    // stream, so before leaving her with the error banner, replay the
    // session server-side and fold the finished conversation, reply
    // included, back into the transcript (web twin has the full story).
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
        void saveChat(storageKey, {
          archived: nextArchived,
          events: [],
          session: undefined,
          messageTimes: {},
          lastActivityAt: Date.now(),
        });
        agent.reset();
        durableCursorRef.current = 0;
        lastSendRef.current = null;
      }
      setRecovering(false);
    })();
    // The closures re-create per render; agent.error is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.error]);

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
    lastStreamActivityRef.current = Date.now();
    let wakeGraceTimer: ReturnType<typeof setTimeout> | null = null;
    const isStale = (stallMs: number) =>
      Date.now() - lastStreamActivityRef.current > stallMs;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!isStale(VISIBLE_STALL_MS) || wakeGraceTimer !== null) return;
      wakeGraceTimer = setTimeout(() => {
        wakeGraceTimer = null;
        // Still nothing after the grace: the stream really is dead.
        if (isStale(VISIBLE_STALL_MS)) agent.stop();
      }, WAKE_GRACE_MS);
    });
    const watchdog = setInterval(() => {
      if (isStale(WATCHDOG_STALL_MS)) agent.stop();
    }, 15_000);
    return () => {
      subscription.remove();
      clearInterval(watchdog);
      if (wakeGraceTimer !== null) clearTimeout(wakeGraceTimer);
    };
    // agent.stop is stable for the store's lifetime; busy is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function sendMessage(text: string) {
    const message = text.trim();
    if (message.length === 0) return;
    setDraft("");
    // Sending mid-turn queues instead of refusing (texting model,
    // founder ruling 2026-07-10 night): the bubble waits by the
    // composer and goes out the moment the line is free.
    if (busy) {
      setQueued((current) => [...current, message]);
      return;
    }
    // A manual send takes the composer back: a still-running recovery
    // of the previous turn stands down (its reply would land into a
    // conversation that has already moved on).
    recoveryRef.current?.abort();
    // A fresh session (first turn, or the reset after a failed one)
    // restarts the durable event cursor.
    if (!agent.session?.sessionId) durableCursorRef.current = 0;
    // A queue held back by a failed turn rides along with the next
    // manual send, in the order she wrote everything.
    const outgoing = [...queued, message].join("\n\n");
    setQueued([]);
    // sendMessage is an event handler, never render; reading the clock
    // is safe here, the purity rule cannot tell (same as the web twin).
    // eslint-disable-next-line react-hooks/purity
    lastSendRef.current = { text: outgoing, atMs: Date.now() };
    markTurnStarted();
    void agent.send({ message: outgoing });
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
    void saveChat(storageKey, {
      archived: nextArchived,
      events: [],
      session: undefined,
      messageTimes: {},
      lastActivityAt: Date.now(),
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
                <MessageView key={item.key} message={item.message} />
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
