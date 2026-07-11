import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useSession } from "../../features/auth/session-provider";
import { ChatSession } from "../../features/chat/chat-session";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  chatStorageKey,
  prepareChat,
  type PreparedChat,
} from "../../lib/chat-storage";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * The Chat tab: loads the persisted transcript and takes the
 * fresh-morning rotation decision before mounting the session
 * (useEveAgent seeds initialEvents at construction), then hands
 * everything to ChatSession. Keyed by user id so switching accounts
 * never bleeds transcripts across users.
 */
export default function ChatScreen() {
  const { session } = useSession();
  const { family, children, memberDisplayName, loading } = useFamilyData();
  const userId = session?.user.id ?? null;
  const [prepared, setPrepared] = useState<PreparedChat | null>(null);
  const readyFamily = family?.profile_completed_at && children.length > 0 ? family : null;

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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            backgroundColor: colors.card,
          }}
        >
          <Logo size={24} />
        </View>

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
          <ChatSession
            key={userId}
            storageKey={chatStorageKey(userId)}
            prepared={prepared}
            familyId={readyFamily.id}
            parentName={memberDisplayName ?? readyFamily.parent_display_name ?? null}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
