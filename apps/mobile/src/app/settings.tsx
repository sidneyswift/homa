import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";

import { Button } from "../components/ui/button";
import { Icon } from "../components/design/icon";
import { Card } from "../components/ui/card";
import { InlineError } from "../components/ui/inline-error";
import { LoadingStatus } from "../components/ui/loading-status";
import { useBillingGate } from "../features/billing/use-billing-gate";
import { useSession } from "../features/auth/session-provider";
import { AddChildForm } from "../features/family/add-child-form";
import { setChildBirthday, type ChildRecord } from "../lib/family";
import { TextField } from "../components/ui/text-field";
import { useFamilyData } from "../features/family/use-family-data";
import { resetOnboardingWalk } from "../features/onboarding/onboarding-state";
import { supabase } from "../lib/supabase";
import { useAccessibilityAnnouncement } from "../lib/accessibility";
import {
  openAppleSubscriptions,
  openPrivacyPolicy,
  openSupportEmail,
  openTermsOfUse,
  openWebAccount,
} from "../lib/web-links";
import { colors, fontFamilies, fontSize, space } from "../theme/app2";

const PLAN_TIER_LABELS: Record<string, string> = {
  regular: "Homa",
  plus: "Homa Plus",
  elite: "Homa Max",
};

/**
 * Settings: the account's real home. Reached from the sidebar drawer's
 * account menu, and BillingGate's own paywall (a walled family must
 * still be able to sign out or delete their account). Subscription
 * state reads GET /api/billing/gate, the same provider-neutral decision
 * every screen is already gated by.
 *
 * Children moved here from the retired Family tab (founder call
 * 2026-07-29, folding Family into Chat's welcome state left "add a
 * child" with nowhere to live; web has no nav-reachable add-child
 * affordance either, kids are added during onboarding there, so this
 * is the one place mobile still needs it).
 *
 * The canonical billing ledger tells this screen which provider is active.
 * Apple subscriptions are managed with Apple, and Stripe subscriptions are
 * managed on the Homa website. A provider never sends a parent to the
 * other provider's empty management surface.
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
      if (gate.billingProvider === "apple") {
        return `${label} is active. Billed through your Apple Account.`;
      }
      if (gate.billingProvider === "stripe") {
        return `${label} is active. Billed through the Homa website.`;
      }
      return `${label} is active.`;
    }
    return gate.lapsed
      ? "Your free days are up."
      : "You haven't started your free 7 days yet.";
  })();
  useAccessibilityAnnouncement(gate ? `Homa plan. ${planLine}` : null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={() => router.back()}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodyMedium,
                fontSize: fontSize.base,
                color: colors.textStrong,
              }}
            >
              Done
            </Text>
          </Pressable>
          <Text
            accessibilityRole="header"
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
          {gate ? (
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              {planLine}
            </Text>
          ) : <LoadingStatus label="Checking your Homa plan" />}
          {gate?.open && gate.billingProvider === "apple" ? (
            <SettingsLinkRow
              label="Manage Apple subscription"
              onPress={() => void openAppleSubscriptions()}
            />
          ) : null}
          {gate?.open && gate.billingProvider === "stripe" ? (
            <SettingsLinkRow
              label="Manage subscription on the web"
              onPress={() => void openWebAccount()}
            />
          ) : null}
        </SettingsSection>

        {family ? (
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
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
                  <ChildRow
                    key={child.id}
                    child={child}
                    familyId={family.id}
                    onSaved={() => void reload()}
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
            onPress={() => {
              // /settings sits outside the (tabs) group, so the reactive
              // `if (!session) return <Redirect>` in (tabs)/_layout.tsx
              // never re-evaluates this screen: signOut() alone cleared
              // the session but left the parent stranded here until a
              // full app relaunch (found live 2026-09-03). delete-account.tsx
              // already navigates explicitly after its own signOut for the
              // same reason; this mirrors it.
              void supabase.auth.signOut().then(() => router.replace("/signin"));
            }}
          />
          <Button
            label="Delete account"
            variant="ghost"
            onPress={() => router.push("/settings/delete-account")}
          />
          {__DEV__ && family ? (
            // Dev-only iteration lever (2026-08-18): rewinds the native
            // onboarding walk so it can be replayed. Not in release builds.
            <Button
              label="↺ dev: restart onboarding walk"
              variant="ghost"
              onPress={() =>
                void resetOnboardingWalk(family.id).then(() =>
                  router.replace("/"),
                )
              }
            />
          ) : null}
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
        accessibilityRole="header"
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

/**
 * One child in the family list. Onboarding stores an age-estimate
 * birthday (flagged birthdayApproximate); this row is the honest
 * refinement moment: the age reads "about" until the real birthday is
 * saved, and saving clears the flag (founder call 2026-08-24).
 */
function ChildRow({
  child,
  familyId,
  onSaved,
}: {
  child: ChildRecord;
  familyId: string;
  onSaved: () => void;
}) {
  const approximate = child.profile?.birthdayApproximate === true;
  const [editing, setEditing] = useState(false);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setError(null);
    setSaving(true);
    const result = await setChildBirthday({
      childId: child.id,
      familyId,
      profile: child.profile ?? {},
      birthYear: Number.parseInt(year, 10),
      birthMonth: Number.parseInt(month, 10),
      birthDay: Number.parseInt(day, 10),
    });
    setSaving(false);
    if (result.error) {
      setError("Pick a valid birthday: month, day, and year.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  return (
    <View style={{ gap: space.xs }}>
      <SettingsRow
        label={child.name}
        value={`${ageLabel(ageInMonths(child.birth_month))}${approximate ? " (about)" : ""}`}
      />
      {approximate && !editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Set ${child.name}'s birthday`}
          onPress={() => setEditing(true)}
          style={{ minHeight: 32, justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.sm,
              color: colors.action,
            }}
          >
            Set the real birthday
          </Text>
        </Pressable>
      ) : null}
      {editing ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Month"
                value={month}
                onChangeText={setMonth}
                placeholder="MM"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Day"
                value={day}
                onChangeText={setDay}
                placeholder="DD"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <TextField
                label="Year"
                value={year}
                onChangeText={setYear}
                placeholder="YYYY"
                keyboardType="number-pad"
              />
            </View>
          </View>
          {error ? <InlineError message={error} /> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button
              label={saving ? "Saving…" : "Save birthday"}
              size="sm"
              onPress={() => void save()}
              disabled={saving}
              busy={saving}
            />
            <Button
              label="Cancel"
              size="sm"
              variant="ghost"
              onPress={() => setEditing(false)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.4;
  return (
    <View style={{ flexDirection: stacked ? "column" : "row", justifyContent: "space-between", gap: stacked ? space.xs : space.md }}>
      <Text
        style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textMuted }}
      >
        {label}
      </Text>
      <Text
        style={{ flexShrink: 1, textAlign: stacked ? "left" : "right", fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}
      >
        {value}
      </Text>
    </View>
  );
}

function SettingsLinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessible
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Opens outside Homa"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{ flexShrink: 1, fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong, textDecorationLine: "underline" }}
      >
        {label}
      </Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="external" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
