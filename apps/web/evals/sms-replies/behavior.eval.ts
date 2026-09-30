import { defineEval } from "eve/evals";

import { assertSmsReplyCase, runSmsReplyCase, SMS_REPLY_CASES } from "./behavior";

export default defineEval({
  description: "Routine SMS updates send only a completed reply, while research and material work retain one heads-up.",
  tags: ["model-backed", "sms"],
  timeoutMs: 600_000,
  async test(t) {
    for (const fixture of SMS_REPLY_CASES) {
      const run = await runSmsReplyCase(fixture.id, t.signal);
      t.log(JSON.stringify(run));
      assertSmsReplyCase(run);
    }
  },
});
