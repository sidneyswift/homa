import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { useSession } from "../../features/auth/session-provider";
import { ChatSession } from "../../features/chat/chat-session";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  chatStorageKey,
  prepareChat,
  type PreparedChat,
} from "../../lib/chat-storage";
import { colors, space } from "../../theme/tokens";

/**
 * The Chat tab: loads the persisted transcript and takes the
 * fresh-morning rotation decision before mounting the session
 * (useEveAgent seeds initialEvents at construction), then hands
 * everything to ChatSession. Keyed by user id so switching accounts
 * never bleeds transcripts across users.
 */
export default function ChatScreen() {
  const { session } = useSession();
  const { family } = useFamilyData();
  const userId = session?.user.id ?? null;
  const [prepared, setPrepared] = useState<PreparedChat | null>(null);

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

        {userId && prepared !== null ? (
          <ChatSession
            key={userId}
            storageKey={chatStorageKey(userId)}
            prepared={prepared}
            familyId={family?.id ?? null}
            parentName={family?.parent_display_name ?? null}
          />
        ) : (
          <ActivityIndicator
            color={colors.brand}
            style={{ marginTop: space.xl }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
