import { defineSchedule } from "eve/schedules";

import { sweepConversationIndex } from "../../lib/learning/conversation-index";

/** Pending markers are committed with messages; this worker is independent of
 * the request lifetime. Drain existing work even after the producer flag is off. */
export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    waitUntil(sweepConversationIndex().then(result => {
      if (result.claimed) console.info("conversation index", result);
    }));
  },
});
