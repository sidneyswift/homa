import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { useSession } from "../../features/auth/session-provider";
import { ChatSession } from "../../features/chat/chat-session";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  chatStorageKey,
  loadSavedChat,
  type SavedChat,
} from "../../lib/chat-storage";
import { colors, space } from "../../theme/tokens";

/**
 * The Chat tab: loads the persisted transcript before mounting the
 * session (useEveAgent seeds initialEvents at construction), then hands
 * everything to ChatSession. Keyed by user id so switching accounts
 * never bleeds transcripts across users.
 */
export default function ChatScreen() {
  const { session } = useSession();
  const { family } = useFamilyData();
  const userId = session?.user.id ?? null;
  const [saved, setSaved] = useState<SavedChat | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void loadSavedChat(chatStorageKey(userId)).then((chat) => {
      if (!cancelled) setSaved(chat);
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

        {userId && saved !== null ? (
          <ChatSession
            key={userId}
            storageKey={chatStorageKey(userId)}
            saved={saved}
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
