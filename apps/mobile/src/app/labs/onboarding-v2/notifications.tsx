import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const HOURS = [7, 8, 9, 10];

function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

/** A real permission request and a real scheduled local notification, the
 * same expo-notifications rail as features/billing/trial-reminder.ts. Not
 * a recurring daily reminder (that trigger shape is a different, unproven
 * surface for this lab); one real notification tomorrow at her chosen hour
 * is enough to prove the rail actually works. */
export default function NotificationsScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const [busy, setBusy] = useState(false);
  const name = firstChild?.name ?? "your kid";

  async function enable() {
    setBusy(true);
    try {
      let settings = await Notifications.getPermissionsAsync();
      if (!settings.granted && settings.canAskAgain) {
        settings = await Notifications.requestPermissionsAsync();
      }
      if (settings.granted && state.reminderHour !== null) {
        const fireAt = new Date();
        fireAt.setDate(fireAt.getDate() + 1);
        fireAt.setHours(state.reminderHour, 0, 0, 0);
        await Notifications.scheduleNotificationAsync({
          content: { title: "Homa", body: `Lesson time for ${name}.` },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        });
        update("notificationsGranted", true);
      } else {
        update("notificationsGranted", false);
      }
    } catch {
      update("notificationsGranted", false);
    }
    setBusy(false);
    router.push("/labs/onboarding-v2/account");
  }

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.94}
      bubbleKey="notifications"
      bubble="Want a nudge when it's lesson time?"
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {HOURS.map((hour) => (
            <Chip
              key={hour}
              label={hourLabel(hour)}
              selected={state.reminderHour === hour}
              role="radio"
              onPress={() => update("reminderHour", hour)}
            />
          ))}
        </View>
        <PrimaryButton label="Turn on reminders" onPress={enable} disabled={state.reminderHour === null} busy={busy} />
        <TextLink
          label="Not now"
          onPress={() => {
            update("notificationsGranted", false);
            router.push("/labs/onboarding-v2/account");
          }}
        />
      </View>
    </OnboardingStage>
  );
}
