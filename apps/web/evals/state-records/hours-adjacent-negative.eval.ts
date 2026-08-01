import { defineEval } from "eve/evals";

/** Logging ordinary school time is adjacent language, but it is not a request
 * for the state-record pack. The hours tool owns the write. */
export default defineEval({
  description:
    "Logging today's school time does not load state-records or open its view.",
  async test(t) {
    const turn = await t.send(
      "We did 45 minutes of math and 30 minutes of reading today. Log that for Maya.",
    );
    t.succeeded();
    t.calledTool("log_hours");
    t.notCalledTool("open_state_records");
    t.eventsSatisfy(
      "state-records was not loaded",
      () =>
        turn.toolCalls.every(
          (call) =>
            call.name !== "load_skill"
            || call.input.skill !== "state-records",
        ),
    );
  },
});
