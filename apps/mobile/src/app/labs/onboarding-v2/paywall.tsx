import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

type Plan = "yearly" | "monthly";

const PLANS: Record<Plan, { label: string; price: string; sub: string; trialDays: number; priceLabel: string }> = {
  yearly: {
    label: "Yearly",
    price: "$99.99/yr",
    sub: "About $8.33 a month.",
    trialDays: 14,
    priceLabel: "$99.99 a year",
  },
  monthly: {
    label: "Monthly",
    price: "$9.99/mo",
    sub: "Billed every month.",
    trialDays: 7,
    priceLabel: "$9.99 a month",
  },
};

const COMPARE_ROWS: { label: string; free: string; membership: string }[] = [
  { label: "Days planned", free: "1 day", membership: "7 days" },
  { label: "Subjects in report", free: "Up to 4", membership: "Up to 16" },
];

/** Existing lab prices and trial lengths. Account linking and purchases remain v2.1 work. */
export default function PaywallScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("yearly");
  const info = PLANS[plan];

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
      onBack={() => router.back()}
      bubble="Choose your plan"
      footer={
        <View style={{ gap: v2Space.xs }}>
          <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}>
            {`${info.trialDays} days free, then ${info.priceLabel}. Renews automatically. Cancel before the trial ends to avoid a charge.`}
          </NativeText>
          <PrimaryButton label={`Start ${info.trialDays}-day free trial`} onPress={accept} />
          <TextLink label="Continue free" onPress={decline} />
        </View>
      }
    >
      <View style={{ gap: v2Space.md, paddingTop: v2Space.md }}>
        <View
          style={{
            borderRadius: v2Radii.control,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: v2Colors.border,
            overflow: "hidden",
            backgroundColor: v2Colors.paper,
          }}
        >
          <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: v2Colors.border }}>
            <View style={{ flex: 1.4 }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>Free</NativeText>
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <NativeText style={[v2Type.caption, { color: v2Colors.coral }]}>Membership</NativeText>
            </View>
          </View>
          {COMPARE_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 6,
                borderBottomWidth: index < COMPARE_ROWS.length - 1 ? 1 : 0,
                borderBottomColor: v2Colors.border,
              }}
            >
              <View style={{ flex: 1.4, paddingLeft: v2Space.sm }}>
                <NativeText style={[v2Type.caption, { color: v2Colors.ink }]}>{row.label}</NativeText>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>{row.free}</NativeText>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{row.membership}</NativeText>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: v2Space.sm }}>
          {(Object.keys(PLANS) as Plan[]).map((key) => {
            const selected = plan === key;
            const planInfo = PLANS[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
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
                  {`${planInfo.label}${selected ? " ✓" : ""}`}
                </NativeText>
                <NativeText style={[v2Type.control, { color: selected ? v2Colors.onMidnight : v2Colors.ink }]}>
                  {planInfo.price}
                </NativeText>
                <NativeText style={[v2Type.caption, { color: selected ? v2Colors.onMidnight : v2Colors.inkMuted }]}>
                  {planInfo.sub}
                </NativeText>
                <NativeText style={[v2Type.caption, { color: selected ? v2Colors.onMidnight : v2Colors.inkMuted }]}>
                  {`${planInfo.trialDays} days free`}
                </NativeText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingStage>
  );
}
