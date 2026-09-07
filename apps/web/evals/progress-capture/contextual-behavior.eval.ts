import { defineEval } from "eve/evals";

import { assertCaptureBehavior, runCaptureBehavior } from "./behavior-harness";

export default defineEval({
  description: "An actual persisted immediate assistant question informs the current parent quote without becoming evidence itself.",
  tags: ["model-backed", "progress-capture"],
  timeoutMs: 180_000,
  async test(t) {
    const run = await runCaptureBehavior("contextual", t.signal);
    t.log(JSON.stringify({phase:"settled-model-and-real-sql-before-assertions",response:run.result.text,tools:run.calls,durable:run.durable,usage:run.result.usage}));
    assertCaptureBehavior(run);
  },
});
