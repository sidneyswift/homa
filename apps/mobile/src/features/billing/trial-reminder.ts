import * as Notifications from "expo-notifications";

/**
 * The local reminder module (D13, ruled 2026-08-31): one rail powers
 * the paywall's automatic trial-end reminder and, once the free-page
 * credit exists, the decline screen's "Remind me later" snooze.
 *
 * The deck binds the paywall's reminder LINE to this module actually
 * being able to fire (copy-deck.md §S10 build requirements): a promise
 * the build cannot keep does not render. canScheduleReminders() is that
 * gate; the Stripe-webhook email reminder does not cover Apple trials
 * (lib/billing/trial-reminder.ts is trial_will_end-driven), so until an
 * Apple email rail exists the line renders only on granted permission
 * (flagged on gh#1045).
 *
 * Scheduling asks for permission when undetermined. The natural moment
 * is right after a purchase confirms, never mid-walk: the in-walk
 * permission beat (DELTA change 3) was DECLINED by Sidney 2026-08-31.
 *
 * A notification tap opens the app; resumability does the rest (the
 * walk re-enters on the exact saved step, and a subscribed family lands
 * in the product). No custom deep-link handling to go stale.
 */

export const TRIAL_REMINDER_DAYS_BEFORE = 2;

/** Deck notification copy (approved 2026-08-31). */
const TRIAL_REMINDER_BODY =
  "Your free week ends in 2 days. If it's not for you, cancel anytime in the App Store.";

/** True only when a scheduled notification would really fire now. */
export async function canScheduleReminders(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted;
  } catch {
    return false;
  }
}

/**
 * Schedules the trial-end reminder for chargeDate minus two days,
 * asking for permission first when it is still undetermined. Returns
 * whether the reminder will actually fire; false is a normal outcome
 * (denied, too close to the charge, or a platform without the module),
 * never an error.
 */
export async function scheduleTrialEndReminder(chargeDate: Date): Promise<boolean> {
  try {
    let settings = await Notifications.getPermissionsAsync();
    if (!settings.granted && settings.canAskAgain) {
      settings = await Notifications.requestPermissionsAsync();
    }
    if (!settings.granted) return false;
    const fireAt = new Date(
      chargeDate.getTime() - TRIAL_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000,
    );
    if (fireAt.getTime() <= Date.now()) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Homa",
        body: TRIAL_REMINDER_BODY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    return true;
  } catch {
    return false;
  }
}
