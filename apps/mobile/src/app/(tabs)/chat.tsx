import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AiConsentGate } from "../../components/ai-consent-gate";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useSession } from "../../features/auth/session-provider";
import { ChatSession } from "../../features/chat/chat-session";
import { parseComposerDraftRequest } from "../../features/chat/composer-draft";
import { useFamilyData } from "../../features/family/use-family-data";
import { type ChildRecord } from "../../lib/family";
import {
  chatStorageKey,
  prepareChat,
  type PreparedChat,
} from "../../lib/chat-storage";
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
  }>();
  const { session } = useSession();
  const { family, children, memberDisplayName, loading } = useFamilyData();
  const userId = session?.user.id ?? null;
  const [prepared, setPrepared] = useState<PreparedChat | null>(null);
  const readyFamily = family?.profile_completed_at && children.length > 0 ? family : null;
  const draftRequest = parseComposerDraftRequest(params.progressDraftId, params.progressDraft);

  const handleDraftRequestHandled = useCallback((requestId: string) => {
    if (draftRequest?.id !== requestId) return;
    router.setParams({ progressDraft: "", progressDraftId: "" });
  }, [draftRequest?.id, router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void prepareChat(chatStorageKey(userId)).then((chat) => {
      if (!cancelled) setPrepared(chat);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isFreshConversation =
    prepared !== null && prepared.archived.length === 0 && prepared.initialEvents.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {loading || !userId || prepared === null ? (
          <ActivityIndicator
            color={colors.brand}
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
              key={userId}
              storageKey={chatStorageKey(userId)}
              prepared={prepared}
              familyId={readyFamily.id}
              parentName={memberDisplayName ?? readyFamily.parent_display_name ?? null}
              draftRequest={draftRequest}
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
