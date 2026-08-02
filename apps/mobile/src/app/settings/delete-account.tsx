import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { supabase } from "../../lib/supabase";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Full deletion, not deactivation (App Review 5.1.1(v)): calls
 * delete_own_account(), a SECURITY DEFINER Postgres function scoped to
 * auth.uid() (supabase/migrations/20260728180000_self_account_deletion.sql).
 * Verified end to end against production on 2026-07-28: a sole-member
 * family's family, children, and derived-signal rows are all removed
 * before the identity itself is; a co-parented family survives for the
 * remaining parent, only the caller's own membership and identity go.
 *
 * Gap, tracked separately: Apple also requires revoking the Sign in with
 * Apple token via its REST API on deletion. That call needs a Sign in
 * with Apple private key from Apple Developer's Keys section (Team ID,
 * Key ID, .p8), which does not exist in this project yet, a founder-only
 * step. Shipping a fake revoke call would be worse than shipping none;
 * this screen deletes the real account and data today, and the revoke
 * call lands the moment that credential exists.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useAccessibilityAnnouncement(
    deleting
      ? "Deleting your account"
      : confirming
        ? "Are you sure? This deletes your account right away."
        : null,
  );

  async function handleDelete() {
    setDeleting(true);
    setErrorMessage(null);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setDeleting(false);
      setErrorMessage(
        "That didn't go through; your account is untouched. Check your connection and try again.",
      );
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
            {
              "This removes your family's information from Homa: your children's profiles, chat history, and records. If you share this family with another parent, their access and the family's records stay in place; only your own account goes."
            }
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            This cannot be undone.
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
            <Button
              label={deleting ? "Deleting…" : "Yes, delete my account"}
              disabled={deleting}
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
