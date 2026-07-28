import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useSession } from "../features/auth/session-provider";
import { supabase } from "../lib/supabase";
import {
  openPrivacyPolicy,
  openSupportEmail,
  openTermsOfUse,
} from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";

/**
 * Settings: the account's real home. Reached from the Today header and a
 * link at the bottom of Family. Subscription state here is deliberately
 * one neutral, non-merchandised line, never a price or a checkout button:
 * the web-subscription-only posture for the App Store companion release
 * (docs/homa-planning/plans/2026-07-28-ios-app-store-launch.md ARC B).
 * Once GET /api/billing/gate exists (ARC E), this can read real trial/
 * active/expired state instead of one static line.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const appVersion = Constants.expoConfig?.version;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodyMedium,
                fontSize: fontSize.base,
                color: colors.brand,
              }}
            >
              Done
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: fontFamilies.display,
              fontSize: fontSize.xxl,
              color: colors.textStrong,
            }}
          >
            Settings
          </Text>
        </View>

        <SettingsSection title="Account">
          {session?.user.email ? (
            <SettingsRow label="Email" value={session.user.email} />
          ) : null}
        </SettingsSection>

        <SettingsSection title="Your Homa plan">
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            {
              "Your subscription is managed on the web at thankshoma.com. Sign in with the same email there to view or change your plan."
            }
          </Text>
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingsLinkRow label="Contact us" onPress={() => void openSupportEmail()} />
          <SettingsLinkRow label="Privacy policy" onPress={() => void openPrivacyPolicy()} />
          <SettingsLinkRow label="Terms of use" onPress={() => void openTermsOfUse()} />
          {appVersion ? <SettingsRow label="Version" value={appVersion} /> : null}
        </SettingsSection>

        <View style={{ gap: space.sm }}>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => void supabase.auth.signOut()}
          />
          <Button
            label="Delete account"
            variant="ghost"
            onPress={() => router.push("/settings/delete-account")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.sm,
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {title}
      </Text>
      <Card style={{ gap: space.sm }}>{children}</Card>
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
      <Text
        style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textMuted }}
      >
        {label}
      </Text>
      <Text
        style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function SettingsLinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Text
        style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.brand }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
