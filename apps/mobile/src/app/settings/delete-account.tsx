import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Full family deletion, not deactivation: the shared server workflow stops
 * Stripe billing, revokes every family session and schedule, deletes scoped
 * artifacts, then removes family records. Apple Sign in token revocation is
 * separately blocked by the founder-only credential in #314, so this UI
 * never claims Apple revoked a token when that credential is unavailable.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  useAccessibilityAnnouncement(
    deleting
      ? "Deleting your account"
      : confirming
        ? "Are you sure? This deletes your account right away."
        : null,
  );

  useEffect(() => {
    async function loadConfirmation(): Promise<void> {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch(`${env.apiUrl}/api/account-deletion`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json().catch(() => null)) as { confirmation?: string } | null;
        if (response.ok && body?.confirmation) setConfirmation(body.confirmation);
        else setErrorMessage("I could not load your family account. Go back and try again.");
      } catch {
        setErrorMessage("I could not load your family account. Go back and try again.");
      }
    }
    void loadConfirmation();
  }, []);

  async function handleDelete() {
    setDeleting(true);
    setErrorMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setDeleting(false);
        setErrorMessage("Your session expired. Sign in again and try once more.");
        return;
      }
      const response = await fetch(`${env.apiUrl}/api/account-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: typedConfirmation }),
      });
      const body = (await response.json().catch(() => null)) as { state?: string; message?: string } | null;
      if (!response.ok || (body?.state !== "complete" && body?.state !== "in_progress")) {
        setDeleting(false);
        setErrorMessage(body?.message ?? "That didn't go through; your account is still available.");
        return;
      }
    } catch {
      setDeleting(false);
      setErrorMessage("That didn't go through; your account is still available.");
      return;
    }
    // The identity behind this session no longer exists. This screen sits
    // outside the (tabs) group, so its session guard never runs here;
    // sign out and navigate explicitly rather than rely on it.
    await supabase.auth.signOut();
    router.replace("/signin");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}
            >
              Back
            </Text>
          </Pressable>
        </View>

        <Text
          accessibilityRole="header"
          style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
        >
          Delete your account
        </Text>

        <Card style={{ gap: space.sm }}>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            This permanently deletes your family&apos;s Homa records and stored files. It signs every parent out and cannot be undone.
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            This cannot be undone.
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            You can download records from Progress and Family Library first, but exporting is optional and will not delay deletion.
          </Text>
        </Card>

        {errorMessage ? <InlineError message={errorMessage} /> : null}

        {!confirming ? (
          <Button
            label="Delete my account"
            variant="ghost"
            onPress={() => setConfirming(true)}
          />
        ) : (
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}
            >
              Are you sure? This deletes your account right away.
            </Text>
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
            >
              Type {confirmation ?? "your family confirmation"} to enable deletion.
            </Text>
            <TextInput
              value={typedConfirmation}
              onChangeText={setTypedConfirmation}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
              placeholder={confirmation ?? "Loading…"}
              style={{
                minHeight: 48,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: space.md,
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textStrong,
              }}
            />
            <Button
              label={deleting ? "Deleting…" : "Yes, delete my account"}
              disabled={deleting || typedConfirmation !== confirmation}
              onPress={() => void handleDelete()}
            />
            <Button
              label="Keep my account"
              variant="secondary"
              disabled={deleting}
              onPress={() => setConfirming(false)}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
