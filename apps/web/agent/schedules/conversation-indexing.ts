import { defineSchedule } from "eve/schedules";

import { runConversationIndexing } from "../../lib/conversation-indexing";
import { conversationRecordingEnabled } from "../../lib/conversation-recording";

export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    if (!conversationRecordingEnabled()) return;
    waitUntil(runConversationIndexing().then(outcomes => {
      if (outcomes.length) console.log("conversation indexing", outcomes);
    }).catch(() => {
      console.error("conversation indexing unavailable; durable jobs will retry");
    }));
  },
});
