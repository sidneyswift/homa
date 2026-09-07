import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

type Plan = "yearly" | "monthly";

const PLANS: Record<Plan, { label: string; price: string; sub: string; fineprint: string }> = {
  yearly: {
    label: "Yearly",
    price: "$99.99/yr",
    sub: "About $8.33 a month.",
    fineprint: "14 days free, then $99.99 a year. Cancel anytime.",
  },
  monthly: {
    label: "Monthly",
    price: "$9.99/mo",
    sub: "Billed every month.",
    fineprint: "7 days free, then $9.99 a month. Cancel anytime.",
  },
};

const FEATURES = ["Every day of the week, not just Monday", "All sixteen subjects in the report, not four", "A new week planned automatically, every week"];

/**
 * Real ruled pricing (2026-09-01 iOS pivot): $9.99/mo or $99.99/yr. No
 * testimonials or "Most popular" badge: neither is supportable pre-launch
 * (docs/homa-planning, paywall claims ruling). Charge terms sit right next
 * to the button per ROSCA and California's automatic-renewal law.
 *
 * Both plans are real, tappable choices (gauntlet-loop finding: the prior
 * version showed two static cards with one CTA and no way to tell which
 * plan it charged). The CTA's own fine print now names the selected
 * plan's real terms, never a generic line that could apply to either.
 *
 * posture="plain", no mascot: the real Keiki paywall (read directly,
 * 2026-09-07) has no character on it anywhere, one of exactly four
 * screens in the whole reference that drop it. Plans sit side by side,
 * not stacked, the other half of why the old version needed a scroll to
 * see everything a single Keiki paywall frame shows at once.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";
  const [plan, setPlan] = useState<Plan>("yearly");

  function accept() {
    router.push({ pathname: "/labs/onboarding-v2/done", params: { outcome: "trial" } });
  }

  function decline() {
    router.push({ pathname: "/labs/onboarding-v2/done", params: { outcome: "declined" } });
  }

  return (
    <OnboardingStage
      posture="plain"
      bubbleKey="paywall"
      bubble={`Keep building with ${name}`}
      footer={
        <View style={{ gap: v2Space.sm }}>
          <PrimaryButton label="Start free trial" onPress={accept} />
          <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}>
            {PLANS[plan].fineprint}
          </NativeText>
          <TextLink label="Not now" onPress={decline} />
        </View>
      }
    >
      <View style={{ gap: v2Space.sm, paddingTop: v2Space.md }}>
        {FEATURES.map((feature) => (
          <View key={feature} style={{ flexDirection: "row", gap: v2Space.sm, alignItems: "flex-start" }}>
            <NativeText style={[v2Type.chip, { color: v2Colors.coral }]}>✓</NativeText>
            <NativeText style={[v2Type.chip, { color: v2Colors.ink, flex: 1 }]}>{feature}</NativeText>
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: v2Space.sm, marginTop: v2Space.sm }}>
          {(Object.keys(PLANS) as Plan[]).map((key) => {
            const selected = plan === key;
            const info = PLANS[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPlan(key)}
                style={{
                  flex: 1,
                  backgroundColor: selected ? v2Colors.midnight : v2Colors.paper,
                  borderRadius: v2Radii.card,
                  borderCurve: "continuous",
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? v2Colors.coral : v2Colors.border,
                  padding: v2Space.md,
                  gap: v2Space.xs,
                }}
              >
                <NativeText style={[v2Type.caption, { color: selected ? v2Colors.onMidnight : v2Colors.inkMuted }]}>
                  {info.label}
                </NativeText>
                <NativeText style={[v2Type.control, { color: selected ? v2Colors.onMidnight : v2Colors.ink }]}>
                  {info.price}
                </NativeText>
                <NativeText style={[v2Type.caption, { color: selected ? v2Colors.onMidnight : v2Colors.inkMuted }]}>
                  {info.sub}
                </NativeText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingStage>
  );
}
