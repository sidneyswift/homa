import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useBillingGate } from "../features/billing/use-billing-gate";
import { useSession } from "../features/auth/session-provider";
import { AddChildForm } from "../features/family/add-child-form";
import { useFamilyData } from "../features/family/use-family-data";
import { supabase } from "../lib/supabase";
import {
  openPrivacyPolicy,
  openSupportEmail,
  openTermsOfUse,
} from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";

const PLAN_TIER_LABELS: Record<string, string> = {
  regular: "Homa",
  plus: "Homa Plus",
  elite: "Homa Max",
};

/**
 * Settings: the account's real home. Reached from the sidebar drawer's
 * account menu, and BillingGate's own paywall (a walled family must
 * still be able to sign out or delete their account). Subscription
 * state reads GET /api/billing/gate (arc F), the same two-provider
 * decision every screen is already gated by.
 *
 * Children moved here from the retired Family tab (founder call
 * 2026-07-29, folding Family into Chat's welcome state left "add a
 * child" with nowhere to live; web has no nav-reachable add-child
 * affordance either, kids are added during onboarding there, so this
 * is the one place mobile still needs it).
 *
 * Gap, tracked as the "Portal split" item on gh#305: this does not yet
 * know WHICH provider (Stripe or Apple) is entitling the family, so it
 * cannot correctly send an Apple subscriber to the App Store's own
 * manage-subscription screen versus a Stripe subscriber to the web
 * portal. Sending everyone to the web is the safe default today; an
 * Apple-only subscriber finds nothing there, a real but narrower gap
 * than guessing wrong and sending a Stripe subscriber to an empty
 * App Store subscriptions list.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { gate } = useBillingGate();
  const { family, children, reload } = useFamilyData();
  const appVersion = Constants.expoConfig?.version;

  const planLine = (() => {
    if (!gate) return "Checking your plan…";
    if (gate.open) {
      const label = PLAN_TIER_LABELS[gate.planTier] ?? "Homa";
      return `${label} is active. Manage or cancel anytime at thankshoma.com.`;
    }
    return gate.lapsed
      ? "Your free days are up."
      : "You haven't started your free 7 days yet.";
  })();

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
            {planLine}
          </Text>
        </SettingsSection>

        {family ? (
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
              Children
            </Text>
            {children.length > 0 ? (
              <Card style={{ gap: space.sm }}>
                {children.map((child) => (
                  <SettingsRow
                    key={child.id}
                    label={child.name}
                    value={ageLabel(ageInMonths(child.birth_month))}
                  />
                ))}
              </Card>
            ) : null}
            <AddChildForm familyId={family.id} onAdded={() => void reload()} />
          </View>
        ) : null}

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
