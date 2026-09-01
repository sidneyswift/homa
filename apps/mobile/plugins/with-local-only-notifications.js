const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * expo-notifications' bundled plugin unconditionally adds the
 * aps-environment entitlement (remote push registration), but Homa's
 * reminders are LOCAL notifications only (features/billing/
 * trial-reminder.ts schedules on-device date triggers; nothing
 * registers for remote push). The App Store provisioning profile does
 * not carry the Push Notifications capability, so claiming
 * aps-environment fails signing outright (EAS build d4e91a9c,
 * 2026-08-31: "Provisioning profile doesn't include the Push
 * Notifications capability"). Local scheduling through
 * UNUserNotificationCenter needs no entitlement, so the honest shape is
 * to claim only what the app uses.
 *
 * Delete ONLY this key (scar 555480f9: a plugin deleting a required
 * Info.plist key caused repeated ITMS-90683 rejections; entitlements
 * carry the same risk, so this stays surgical). If Homa ever ships
 * remote push, delete this plugin AND have the founder add the Push
 * Notifications capability to the App ID + regenerate the profile in
 * the same change.
 */
module.exports = function withLocalOnlyNotifications(config) {
  return withEntitlementsPlist(config, (nextConfig) => {
    delete nextConfig.modResults["aps-environment"];
    return nextConfig;
  });
};
