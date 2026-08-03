import { defineSchedule } from "eve/schedules";

import { retryPendingAccountDeletions } from "../../lib/account-deletion";

/** Reliability floor for account deletion. A failed artifact-store operation
 * stays visible in the audit job and is retried without restoring access. */
export default defineSchedule({
  cron: "*/5 * * * *",
  run({ waitUntil }) {
    waitUntil(retryPendingAccountDeletions());
  },
});
