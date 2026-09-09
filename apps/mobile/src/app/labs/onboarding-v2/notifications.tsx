import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

const HOURS = [7, 8, 9, 10];

/** This lab schedules one local notification tomorrow, only on an explicit tap. */
export default function NotificationsScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = firstChild?.name ?? "your child";

  async function enable() {
    if (busy || state.reminderHour === null) return;
    setBusy(true);
    setError(null);
    try {
      let settings = await Notifications.getPermissionsAsync();
      if (!settings.granted && settings.canAskAgain) settings = await Notifications.requestPermissionsAsync();
      if (!settings.granted) {
        update("notificationsGranted", false);
        setError("Notifications are off. You can enable them in Settings or continue without a reminder.");
        return;
      }
      const fireAt = new Date();
      fireAt.setDate(fireAt.getDate() + 1);
      fireAt.setHours(state.reminderHour, 0, 0, 0);
      await Notifications.scheduleNotificationAsync({
        content: { title: "Homa", body: `Lesson time for ${name}.` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
      });
      update("notificationsGranted", true);
      router.push("/labs/onboarding-v2/account");
    } catch {
      update("notificationsGranted", false);
      setError("The reminder wasn't set. Try again or continue without it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="Lesson reminder" bubbleKey="notifications"
      bubble="Would you like a lesson reminder tomorrow?"
      footer={<View style={{ gap: v2Space.sm }}>
        {error ? <NativeText accessibilityRole="alert" style={[v2Type.caption, { color: v2Colors.ink }]}>{error}</NativeText> : null}
        <TextLink label="Continue without a reminder" disabled={busy} onPress={() => {
          update("notificationsGranted", false);
          router.push("/labs/onboarding-v2/account");
        }} />
        <PrimaryButton label="Set reminder" onPress={enable} disabled={state.reminderHour === null} busy={busy} />
      </View>}>
      <View style={{ gap: v2Space.sm }}>
        {HOURS.map((hour) => <RadioRow key={hour} label={`${hour}:00 AM`}
          selected={state.reminderHour === hour} onPress={() => update("reminderHour", hour)} />)}
      </View>
    </OnboardingStage>
  );
}
