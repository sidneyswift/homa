import { useRouter } from "expo-router";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

/** Simple leading glyphs, not exact trademark reproductions: this screen
 * never ships, and the gauntlet-loop critique's real point was that three
 * identical unmarked pills are hard to tell apart at a glance, not that
 * Homa needs pixel-perfect provider marks. */
function AppleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill={v2Colors.onMidnight}
        d="M16.5 1.5c.1 1.2-.35 2.35-1.05 3.2-.72.87-1.9 1.55-3.05 1.46-.13-1.15.42-2.35 1.1-3.1.75-.85 2-1.5 3-1.56Z"
      />
      <Path
        fill={v2Colors.onMidnight}
        d="M20.5 17.1c-.5 1.15-.74 1.66-1.38 2.67-.9 1.4-2.16 3.15-3.73 3.16-1.4.02-1.76-.9-3.65-.89-1.9.01-2.29.91-3.7.9-1.57-.02-2.76-1.6-3.66-3-2.52-3.9-2.78-8.47-1.23-10.9.9-1.4 2.35-2.28 3.7-2.28 1.38 0 2.24.9 3.38.9 1.1 0 1.77-.9 3.38-.9 1.15 0 2.37.63 3.24 1.72-2.85 1.56-2.39 5.6.65 6.62Z"
      />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22 12.2c0-.75-.07-1.47-.2-2.16H12v4.1h5.6c-.24 1.3-.98 2.4-2.09 3.14v2.6h3.38C20.9 18 22 15.36 22 12.2Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.38-2.6c-.94.63-2.14 1-3.23 1-2.48 0-4.58-1.67-5.33-3.92H3.2v2.66C4.85 19.68 8.16 22 12 22Z" />
      <Path fill="#FBBC05" d="M6.67 14.06a5.97 5.97 0 0 1 0-4.12V7.28H3.2a10 10 0 0 0 0 9.44l3.47-2.66Z" />
      <Path fill="#EA4335" d="M12 6.02c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.98 14.7 2 12 2 8.16 2 4.85 4.32 3.2 7.28l3.47 2.66C7.42 7.69 9.52 6.02 12 6.02Z" />
    </Svg>
  );
}

function EmailGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="none"
        stroke={v2Colors.onMidnight}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18v12H3z"
      />
      <Path fill="none" stroke={v2Colors.onMidnight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
    </Svg>
  );
}

/**
 * Three doors, styled after the real passwordless front door
 * (features/auth). Functionally inert: v2.0 has no backend (state.tsx's
 * own header comment), so every door leads to the same place. Wiring these
 * to real Supabase anonymous-identity linking is v2.1 scope.
 *
 * posture="plain", no mascot: the real Keiki account-signup screen (read
 * directly, 2026-09-07) is a bare form, no character, a plain two-tier
 * heading instead. Same category as the paywall right after it.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";

  function claim() {
    router.push("/labs/onboarding-v2/paywall");
  }

  return (
    <OnboardingStage
      posture="plain"
      onBack={() => router.back()}
      bubbleKey="account"
      bubble={
        <View style={{ gap: v2Space.xs }}>
          <NativeText style={[v2Type.hero, { color: v2Colors.ink, textAlign: "center" }]}>Last step</NativeText>
          <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}>
            {`Save ${name}'s week so it's here tomorrow.`}
          </NativeText>
        </View>
      }
    >
      <View style={{ gap: v2Space.sm, paddingTop: v2Space.lg }}>
        <PrimaryButton label="Continue with Apple" icon={<AppleGlyph />} onPress={claim} />
        <PrimaryButton label="Continue with Google" icon={<GoogleGlyph />} onPress={claim} />
        <PrimaryButton label="Continue with email" icon={<EmailGlyph />} onPress={claim} />
      </View>
    </OnboardingStage>
  );
}
