const { withInfoPlist } = require("expo/config-plugins");

/**
 * expo-calendar's bundled plugin adds full Calendar and Reminders usage
 * strings even when Homa only requests EventKit write-only access. Keep
 * the shipped plist honest: the app can ask only to add selected events.
 */
module.exports = function withWriteOnlyCalendar(config) {
  return withInfoPlist(config, (nextConfig) => {
    delete nextConfig.modResults.NSCalendarsUsageDescription;
    delete nextConfig.modResults.NSCalendarsFullAccessUsageDescription;
    delete nextConfig.modResults.NSRemindersUsageDescription;
    delete nextConfig.modResults.NSRemindersFullAccessUsageDescription;
    nextConfig.modResults.NSCalendarsWriteOnlyAccessUsageDescription =
      "Homa adds only the planner items you choose. It cannot read your calendar.";
    return nextConfig;
  });
};
