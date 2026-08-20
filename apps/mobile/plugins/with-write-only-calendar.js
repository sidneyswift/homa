const { withInfoPlist } = require("expo/config-plugins");

/**
 * expo-calendar's bundled plugin adds full Calendar and Reminders usage
 * strings even when Homa only requests EventKit write-only access. Keep
 * the shipped plist honest: the app can ask only to add selected events.
 *
 * NSCalendarsUsageDescription must still be PRESENT, not deleted (Apple
 * ITMS-90683, hit on every production build from 2026-08-01 to
 * 2026-08-20): Apple's compliance scanner requires the general purpose
 * string whenever EventKit symbols are linked at all, regardless of
 * which permission level the app actually requests at runtime. Deleting
 * it here silently undid any fix to app.json's static infoPlist on
 * every single prebuild. Reminders and full calendar access genuinely
 * are not used, so those three stay deleted.
 */
module.exports = function withWriteOnlyCalendar(config) {
  return withInfoPlist(config, (nextConfig) => {
    delete nextConfig.modResults.NSCalendarsFullAccessUsageDescription;
    delete nextConfig.modResults.NSRemindersUsageDescription;
    delete nextConfig.modResults.NSRemindersFullAccessUsageDescription;
    nextConfig.modResults.NSCalendarsWriteOnlyAccessUsageDescription =
      "Homa adds only the planner items you choose. It cannot read your calendar.";
    nextConfig.modResults.NSCalendarsUsageDescription =
      "Homa only adds the planner items you choose to your calendar. It never reads what is already there.";
    return nextConfig;
  });
};
