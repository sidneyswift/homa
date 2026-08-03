import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Client } from "eve/client";
import { ageInMonths, ageLabel } from "@homa/core";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AiConsentGate } from "../../components/ai-consent-gate";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import { useSession } from "../../features/auth/session-provider";
import {
  buildEveTransport,
  ChatSession,
} from "../../features/chat/chat-session";
import { parseComposerDraftRequest } from "../../features/chat/composer-draft";
import {
  progressChildIdFromRoute,
  progressDraftIntentFromRoute,
  progressFingerprintFromRoute,
} from "../../features/chat/progress-draft";
import { useFamilyData } from "../../features/family/use-family-data";
import { type ChildRecord } from "../../lib/family";
import {
  chatStorageKey,
  prepareChat,
  type PreparedChat,
} from "../../lib/chat-storage";
import {
  adoptServerBoundSession,
  fetchMobileChatHistory,
  hydratePreparedChatWithServerHistory,
  type MobileChatHistoryPayload,
} from "../../lib/chat-history";
import { env } from "../../lib/env";
import { reportCrash } from "../../lib/crash-reporting";
import { restoreServerBoundMobileSession } from "../../lib/session-binding";
import { supabase } from "../../lib/supabase";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Chat is the app's front door (founder call 2026-07-29, matching web:
 * /app IS chat, there is no separate landing screen). The former
 * Today tab's greeting and kid cards fold in here as the welcome
 * state, shown only on a truly fresh conversation (no archived
 * messages, no in-flight session); once she has talked to Homa at
 * all, this screen is just the transcript, same as it always was.
 */
export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    progressDraft?: string | string[];
    progressDraftId?: string | string[];
    progressChildId?: string | string[];
    progressIntent?: string | string[];
    progressNextMoveFingerprint?: string | string[];
  }>();
  const { session, continueSignedOut } = useSession();
  const { family, children, memberDisplayName, loading } = useFamilyData();
  const userId = session?.user.id ?? null;
  const [preparedState, setPreparedState] = useState<{
    userId: string;
    chat: PreparedChat;
    history: MobileChatHistoryPayload | null;
    historySettled: boolean;
    sessionReady: boolean;
    restoreError: "auth" | "timeout" | null;
  } | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [prepareErrorUserId, setPrepareErrorUserId] = useState<string | null>(null);
  const prepareError = prepareErrorUserId === userId;
  const prepared = preparedState?.userId === userId ? preparedState.chat : null;
  const restoringSession =
    preparedState?.userId === userId
      ? !preparedState.sessionReady || !preparedState.historySettled
      : true;
  const readyFamily = family?.profile_completed_at && children.length > 0 ? family : null;
  const draftRequest = parseComposerDraftRequest(params.progressDraftId, params.progressDraft);
  const requestedProgressChildId = progressChildIdFromRoute(
    params.progressChildId,
  );
  const initialProgressChildId = children.some(
    (child) => child.id === requestedProgressChildId,
  )
    ? requestedProgressChildId
    : null;
  const initialProgressIntent = progressDraftIntentFromRoute(
    params.progressIntent,
  );
  const initialProgressFingerprint = progressFingerprintFromRoute(
    params.progressNextMoveFingerprint,
  );
  const hasValidProgressContext =
    initialProgressChildId !== null &&
    initialProgressIntent !== null &&
    (initialProgressIntent === "share_progress_evidence" ||
      initialProgressFingerprint !== null);
  const validatedDraftRequest = hasValidProgressContext ? draftRequest : null;
  const handleDraftRequestHandled = useCallback(
    (requestId: string) => {
      if (validatedDraftRequest?.id !== requestId) return;
      router.setParams({
        progressDraft: "",
        progressDraftId: "",
        progressChildId: "",
        progressIntent: "",
        progressNextMoveFingerprint: "",
      });
    },
    [router, validatedDraftRequest?.id],
  );

  useEffect(() => {
    if (!userId || loading) return;
    const controller = new AbortController();
    const timeZone = family?.time_zone ?? null;

    async function bearer(): Promise<string> {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? "";
    }

    void prepareChat(chatStorageKey(userId), timeZone)
      .then((chat) => {
        if (controller.signal.aborted) return;
        const hasLocalSession = Boolean(chat.initialSession?.sessionId);
        setPreparedState({
          userId,
          chat,
          history: null,
          historySettled: false,
          sessionReady: hasLocalSession,
          restoreError: null,
        });

        void (async () => {
          const history = await fetchMobileChatHistory(await bearer(), {
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          setPreparedState((current) => {
            if (!current || current.userId !== userId) return current;
            return {
              ...current,
              chat: history
                ? hydratePreparedChatWithServerHistory(current.chat, history)
                : current.chat,
              history,
              historySettled: true,
            };
          });

          if (hasLocalSession) return;
          const client = new Client(buildEveTransport());
          const restored = await restoreServerBoundMobileSession({
            client,
            apiOrigin: env.apiUrl,
            bearer,
            timeZone,
            signal: controller.signal,
          });
          if (!restored || controller.signal.aborted) return;
          if (restored.kind === "unavailable") {
            setPreparedState((current) => {
              if (!current || current.userId !== userId) return current;
              return { ...current, restoreError: restored.reason };
            });
            return;
          }
          setPreparedState((current) => {
            if (!current || current.userId !== userId) return current;
            const restoredChat = restored.kind === "resumed"
              ? adoptServerBoundSession(
                  current.chat,
                  restored.events,
                  restored.session,
                )
              : adoptServerBoundSession(current.chat, [], undefined);
            return {
              ...current,
              chat: current.history
                ? hydratePreparedChatWithServerHistory(restoredChat, current.history)
                : restoredChat,
              sessionReady: true,
              restoreError: null,
            };
          });
        })().catch((cause) => {
          if (controller.signal.aborted) return;
          reportCrash(cause, {
            surface: "native-chat",
            operation: "prepare-conversation",
          });
          setPrepareErrorUserId(userId);
        });
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        reportCrash(cause, {
          surface: "native-chat",
          operation: "prepare-conversation",
        });
        setPrepareErrorUserId(userId);
      });
    return () => {
      controller.abort();
    };
  }, [family?.time_zone, loading, restoreAttempt, userId]);

  const isFreshConversation =
    prepared !== null &&
    preparedState?.historySettled === true &&
    prepared.archived.length === 0 &&
    prepared.initialEvents.length === 0;
  const chatSessionKey = preparedState?.historySettled !== true
    ? "hydrating"
    : prepared?.initialSession?.sessionId ??
      (restoringSession ? "restoring" : "fresh");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {loading || !userId ? (
          <LoadingStatus
            label="Opening your conversation"
            style={{ marginTop: space.xl }}
          />
        ) : prepareError ? (
          <View style={{ padding: space.lg }}>
            <Card style={{ gap: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamilies.displaySemibold,
                  fontSize: fontSize.lg,
                  color: colors.textStrong,
                }}
              >
                Homa is ready when you are
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.base,
                  color: colors.textBody,
                }}
              >
                Your saved conversation stayed safe, but this screen could not open it yet.
              </Text>
              <Button
                label="Try again"
                onPress={() => {
                  setPreparedState(null);
                  setPrepareErrorUserId(null);
                  setRestoreAttempt((current) => current + 1);
                }}
              />
            </Card>
          </View>
        ) : prepared === null ? (
          <LoadingStatus
            label="Opening your conversation"
            style={{ marginTop: space.xl }}
          />
        ) : preparedState?.restoreError ? (
          <View style={{ padding: space.lg }}>
            <Card style={{ gap: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamilies.displaySemibold,
                  fontSize: fontSize.lg,
                  color: colors.textStrong,
                }}
              >
                Your conversation is safe
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.base,
                  color: colors.textBody,
                }}
              >
                {preparedState.restoreError === "auth"
                  ? "Your sign-in needs another look before Homa can reopen this conversation."
                  : "Homa could not reopen this conversation yet. Nothing changed."}
              </Text>
              <InlineError
                message={
                  preparedState.restoreError === "auth"
                    ? "Sign in again to continue."
                    : "Try again when your connection is steadier."
                }
              />
              <Button
                label={preparedState.restoreError === "auth" ? "Sign in again" : "Try again"}
                onPress={() => {
                  if (preparedState.restoreError === "auth") {
                    continueSignedOut();
                    return;
                  }
                  setPreparedState((current) => current
                    ? { ...current, restoreError: null }
                    : current);
                  setRestoreAttempt((current) => current + 1);
                }}
              />
            </Card>
          </View>
        ) : !readyFamily ? (
          <View style={{ padding: space.lg }}>
            <Card style={{ gap: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamilies.displaySemibold,
                  fontSize: fontSize.lg,
                  color: colors.textStrong,
                }}
              >
                Finish setup first
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.base,
                  color: colors.textBody,
                }}
              >
                Open the web onboarding so Homa has your family basics and your kids
                before chat starts here.
              </Text>
              <Button
                label="Open onboarding"
                onPress={() => void openWebOnboarding()}
              />
            </Card>
          </View>
        ) : (
          <AiConsentGate>
            {isFreshConversation ? (
              <WelcomeHeader
                greeting={memberDisplayName ?? readyFamily.parent_display_name}
                familyName={readyFamily.name}
                kids={children}
              />
            ) : null}
            <ChatSession
              key={`${userId}:${chatSessionKey}`}
              storageKey={chatStorageKey(userId)}
              prepared={prepared}
              restoringSession={restoringSession}
              familyId={readyFamily.id}
              parentName={memberDisplayName ?? readyFamily.parent_display_name ?? null}
              draftRequest={validatedDraftRequest}
              initialProgressChildId={initialProgressChildId}
              initialProgressIntent={initialProgressIntent}
              initialProgressFingerprint={initialProgressFingerprint}
              onDraftRequestHandled={handleDraftRequestHandled}
            />
          </AiConsentGate>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The former Today tab's greeting + kid cards, now Chat's own
 *  welcome state instead of a separate screen a family had to leave
 *  chat to reach. */
function WelcomeHeader({
  greeting,
  familyName,
  kids,
}: {
  greeting: string | null;
  familyName: string;
  kids: ChildRecord[];
}) {
  return (
    <View style={{ padding: space.lg, paddingBottom: space.md, gap: space.md }}>
      <Text
        style={{
          fontFamily: fontFamilies.display,
          fontSize: fontSize.xxl,
          lineHeight: fontSize.xxl * 1.1,
          color: colors.textStrong,
        }}
      >
        {greeting ? `Hi ${greeting}.` : familyName}
      </Text>
      {kids.map((child) => (
        <Card key={child.id} style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            {child.name}
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textMuted,
              }}
            >
              {"  "}
              {ageLabel(ageInMonths(child.birth_month))}
            </Text>
          </Text>
          {child.profile.interests?.length ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}
            >
              Into: {child.profile.interests.join(", ")}
            </Text>
          ) : null}
          {child.profile.focus ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}
            >
              Working on: {child.profile.focus}
            </Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
