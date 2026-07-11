import { useEffect, useRef, useState } from "react";
import {
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
 */

// agent.ts pins the gateway model: the mid tier in journeys/06 terms.
const MODEL_TIER = "mid" as const;

const SUGGESTIONS = [
  "What should we work on this week?",
  "Make a worksheet for today",
  "We had a rough morning, help me reset",
] as const;

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
  const [draft, setDraft] = useState("");

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
    initialEvents: prepared.initialEvents,
    initialSession: prepared.initialSession,
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
      void emitTurnCompleted("ok");
    },
  });

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    archivedRef.current = archived;
  }, [archived]);

  useEffect(() => {
    if (agent.error && agent.error !== reportedErrorRef.current) {
      reportedErrorRef.current = agent.error;
      void emitTurnCompleted("error", "turn_failed");
    }
    // emitTurnCompleted is re-created per render; agent.error is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.error]);

  function sendMessage(text: string) {
    const message = text.trim();
    if (message.length === 0 || busy) return;
    setDraft("");
    markTurnStarted();
    void agent.send({ message });
  }

  /** The manual fresh start: archive what is on screen, rotate the
   *  session, keep every word visible above. Nothing is erased. */
  function startNewChat() {
    const nextArchived = [
      ...archivedRef.current,
      ...archiveMessages(messages, stampMessageTimes(liveTimes, messages)),
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
        {agent.error ? (
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
          editable={!busy}
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
            opacity: busy ? 0.6 : 1,
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => sendMessage(draft)}
          disabled={busy || draft.trim().length === 0}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: radius.pill,
            backgroundColor: pressed ? colors.brandHover : colors.brand,
            paddingHorizontal: space.lg,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || draft.trim().length === 0 ? 0.6 : 1,
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
