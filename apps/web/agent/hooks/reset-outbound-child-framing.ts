import { defineHook } from "eve/hooks";

import { resetOutboundChildFramingApproval } from "../outbound-child-framing-state";

export default defineHook({
  events: {
    async "turn.started"() {
      resetOutboundChildFramingApproval();
    },
  },
});
