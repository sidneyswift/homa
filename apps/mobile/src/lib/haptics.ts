import * as Haptics from "expo-haptics";

/**
 * The walk's spare haptic system (D16, ruled 2026-08-31): a selection
 * tick on every chip/answer/option tap, a light impact on screen
 * advance, and the success note on exactly three moments (checklist
 * chapter complete, the reveal, purchase confirmed). Nothing else, on
 * purpose: a vocabulary this small stays legible under the thumb.
 *
 * Every call is fire-and-forget and swallow-on-failure: haptics are
 * seasoning, and a simulator or a device with haptics disabled must
 * never turn a tap into an error. The system Reduce Motion / haptics
 * settings are respected by the OS underneath expo-haptics.
 */

export function hapticTick(): void {
  void Haptics.selectionAsync().catch(() => {});
}

export function hapticAdvance(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}
