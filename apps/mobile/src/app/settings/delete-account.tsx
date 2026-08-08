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
 * Full family deletion, not deactivation. The shared server workflow first
 * confirms provider state, then closes access and removes schedules, artifacts,
 * and family records. Store-managed subscriptions must end before acceptance.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  useAccessibilityAnnouncement(
    deleting
      ? "Deleting this family's Homa data"
      : confirming
        ? "Are you sure? Homa confirms billing before access closes."
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
    setStatusMessage(null);
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
      const body = (await response.json().catch(() => null)) as {
        state?: string;
        message?: string;
        accessClosed?: boolean;
      } | null;
      if (!response.ok || (body?.state !== "complete" && body?.state !== "in_progress")) {
        setDeleting(false);
        setErrorMessage(body?.message ?? "Homa could not confirm the deletion status. Go back and check whether this family is still available before trying again.");
        return;
      }
      if (body.accessClosed !== true) {
        setDeleting(false);
        setStatusMessage(
          body.message
            ?? "Homa is confirming billing before closing access. You do not need to do anything.",
        );
        return;
      }
    } catch {
      setDeleting(false);
      setErrorMessage("Homa could not confirm the deletion status. Go back and check whether this family is still available before trying again.");
      return;
    }
    // This family is no longer available through the current session. The
    // adult may still belong to another Homa family, so clear only this
    // device session rather than revoking every refresh token globally.
    await supabase.auth.signOut({ scope: "local" });
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
          Delete this family&apos;s Homa data
        </Text>

        <Card style={{ gap: space.sm }}>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            This permanently deletes this family&apos;s Homa records and stored files. It cannot be undone.
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            After Homa confirms billing is safe, access to this family closes and Homa stops future reminders before deleting the family&apos;s data.
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            If you subscribed through the App Store or Google Play, cancel there first. Homa can start deletion after the subscription ends.
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            If you want copies, save what you need from Progress and Family Library before you continue. This is optional and does not delay deletion.
          </Text>
        </Card>

        {errorMessage ? <InlineError message={errorMessage} /> : null}
        {statusMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {statusMessage}
          </Text>
        ) : null}

        {!confirming ? (
          <Button
            label="Delete this family's Homa data"
            variant="ghost"
            onPress={() => setConfirming(true)}
          />
        ) : (
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}
            >
              Homa confirms billing before access closes.
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
              label={deleting ? "Deleting…" : "Delete this family's Homa data"}
              disabled={deleting || typedConfirmation !== confirmation}
              onPress={() => void handleDelete()}
            />
            <Button
              label="Keep this family's Homa data"
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
