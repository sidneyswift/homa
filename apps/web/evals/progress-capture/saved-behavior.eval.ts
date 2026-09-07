import { defineEval } from "eve/evals";

import { assertCaptureBehavior, runCaptureBehavior } from "./behavior-harness";

export default defineEval({
  description: "A named ability report reaches real journal capture, current-message evidence, operation and live projection.",
  tags: ["model-backed", "progress-capture"],
  timeoutMs: 180_000,
  async test(t) {
    const run = await runCaptureBehavior("named", t.signal);
    t.log(JSON.stringify({phase:"settled-model-and-real-sql-before-assertions",response:run.response,tools:run.calls,durable:run.durable,usage:run.result.usage}));
    assertCaptureBehavior(run);
  },
});
