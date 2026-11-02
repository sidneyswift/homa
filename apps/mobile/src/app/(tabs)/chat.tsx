import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Client } from "eve/client";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AiConsentGate } from "../../components/ai-consent-gate";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
import { restoreServerBoundMobileSession } from "../../lib/session-binding";
import { supabase } from "../../lib/supabase";
import { fontFamilies , colors, fontSize, space } from "../../theme/app2";

/** Stable identity: a new object every render would refire the composer
 *  effect that watches for it. */
const PLAN_WEEK_DRAFT = { id: "plan-week-intent", text: "Let's plan our week." };

/**
 * Chat is the app's front door (founder call 2026-07-29, matching web:
 * /app IS chat, there is no separate landing screen). App 2 (gh#1236)
 * opens a fresh conversation on Homa herself and the composer, the same
 * white canvas as web's /app2; the transcript appears once she talks.
 */
export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    progressDraft?: string | string[];
    progressDraftId?: string | string[];
    progressChildId?: string | string[];
    progressIntent?: string | string[];
    progressNextMoveFingerprint?: string | string[];
    planIntent?: string | string[];
  }>();
  const { session } = useSession();
  const { family, children, loading } = useFamilyData();
  const userId = session?.user.id ?? null;
  const [preparedState, setPreparedState] = useState<{
    userId: string;
    chat: PreparedChat;
    history: MobileChatHistoryPayload | null;
    historySettled: boolean;
    sessionReady: boolean;
  } | null>(null);
  const prepared = preparedState?.userId === userId ? preparedState.chat : null;
  const restoringSession =
    preparedState?.userId === userId
      ? !preparedState.sessionReady || !preparedState.historySettled
      : true;
  // OnboardingGate (the tabs layout's outer wrapper) has already proven
  // onboarding is done, web or native, before this screen ever mounts.
  // A native walk sets mobile_onboarding_state.completed_at, never
  // profile_completed_at, so re-checking that web-only stamp here read a
  // finished native family as unready and sent her to web onboarding to
  // "finish" something already done (live bug, 2026-08-23).
  const readyFamily = family && children.length > 0 ? family : null;
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
  // The "Plan our week" onboarding door (next.tsx): unlike a progress
  // draft, this carries no child or evidence to verify, so it skips
  // that binding entirely and is just her own opening line, waiting in
  // the box for her to send or edit.
  const planIntentParam = Array.isArray(params.planIntent)
    ? params.planIntent[0]
    : params.planIntent;
  const planWeekDraft = planIntentParam === "week" ? PLAN_WEEK_DRAFT : null;
  const handlePlanWeekDraftHandled = useCallback(() => {
    router.setParams({ planIntent: "" });
  }, [router]);

  useEffect(() => {
    if (!userId || loading) return;
    const controller = new AbortController();
    const timeZone = family?.time_zone ?? null;

    async function bearer(): Promise<string> {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? "";
    }

    void prepareChat(chatStorageKey(userId), timeZone).then((chat) => {
      if (controller.signal.aborted) return;
      const hasLocalSession = Boolean(chat.initialSession?.sessionId);
      setPreparedState({
        userId,
        chat,
        history: null,
        historySettled: false,
        sessionReady: hasLocalSession,
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
          };
        });
      })();
    });
    return () => {
      controller.abort();
    };
  }, [family?.time_zone, loading, userId]);

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
        {loading || !userId || prepared === null ? (
          <LoadingStatus
            label="Opening your conversation"
            style={{ marginTop: space.xl }}
          />
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
                Add your kid so Homa knows who every page is for before chat starts here.
              </Text>
              <Button
                label="Add a kid"
                onPress={() => router.replace("/kids" as never)}
              />
            </Card>
          </View>
        ) : (
          <AiConsentGate>
            <ChatSession
              key={`${userId}:${chatSessionKey}`}
              storageKey={chatStorageKey(userId)}
              prepared={prepared}
              restoringSession={restoringSession}
              familyId={readyFamily.id}
              draftRequest={validatedDraftRequest}
              planWeekDraft={planWeekDraft}
              onPlanWeekDraftHandled={handlePlanWeekDraftHandled}
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
