import { withTimedHooks } from "../../lib/observability/chat-timing-hooks";
import { defineHook } from "eve/hooks";

import { resetOutboundChildFramingApproval } from "../outbound-child-framing-state";

export default defineHook(withTimedHooks("reset-outbound-child-framing", {
  events: {
    async "turn.started"() {
      resetOutboundChildFramingApproval();
    },
  },
}));
