import { defineSchedule } from "eve/schedules";

import { kickConversationRecording } from "../../lib/conversation-request-kick";
import conversationRequestChannel from "../channels/conversation-request";
import { runConversationRequestCycle } from "../conversation-request-cycle";

/** Durable pickup is independent of the browser and any immediate HTTP kick. */
export default defineSchedule({
  cron: "* * * * *",
  run({ receive, waitUntil }) {
    waitUntil(kickConversationRecording());
    waitUntil(runConversationRequestCycle(input => receive(conversationRequestChannel, { ...input, target: {} })));
  },
});
