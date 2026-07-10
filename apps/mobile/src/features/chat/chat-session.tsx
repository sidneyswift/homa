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
import { clearSavedChat, saveChat, type SavedChat } from "../../lib/chat-storage";
import { emitFamilyEvent } from "../../lib/events";
import { supabase } from "../../lib/supabase";
import { markTurnStarted, takeTurnLatencyMs } from "../../lib/turn-clock";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";
import { busyLabel, countLastTurnToolCalls } from "./message-utils";
import { BusyBubble, MessageView } from "./message-view";

/**
 * The chat surface, the mobile twin of apps/web/app/app/chat/chat-client.tsx:
 * useEveAgent drives session state against the deployed eve routes
 * (host = EXPO_PUBLIC_API_URL); auth rides as a bearer token resolved
 * fresh per request. Homa's per-family context is injected server-side
 * on every turn, so a brand-new session already knows the family.
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
  saved,
  familyId,
  parentName,
}: {
  storageKey: string;
  saved: SavedChat;
  familyId: string | null;
  parentName: string | null;
}) {
  const messagesRef = useRef<readonly EveMessage[]>([]);
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
    initialEvents: saved.events ?? [],
    initialSession: saved.session,
    onFinish(snapshot) {
      void saveChat(storageKey, {
        events: snapshot.events,
        session: snapshot.session,
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

  function startNewChat() {
    void clearSavedChat(storageKey);
    agent.reset();
  }

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
        {messages.length === 0 ? (
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
                <Pressable
                  key={suggestion}
                  onPress={() => sendMessage(suggestion)}
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
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((message) => (
            <MessageView key={message.id} message={message} />
          ))
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
