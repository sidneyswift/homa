import { defineEval } from "eve/evals";

import {
  EVAL_FIRST_MAKING_FIXTURE_CHILD_ID,
  EVAL_FIRST_MAKING_MODE_HEADER_VALUE,
  EVAL_ONBOARDING_MODE_HEADER,
} from "../../lib/family-context-eval-fixture";

const INTEREST_ANSWER =
  "She's completely obsessed with dinosaurs right now, draws them constantly.";

/**
 * Regression for gh#416. The fixture is already at onboarding beat 5: Story
 * exists, has no saved interests, and Sidney has just answered Homa's question
 * about what Story loves. The making must start before the checklist can take
 * over the screen.
 */
export default defineEval({
  description:
    "A concrete child interest starts the first making before onboarding opens the checklist.",
  tags: ["model-backed", "onboarding"],
  timeoutMs: 120_000,
  async test(t) {
    const turn = await t.send({
      message: INTEREST_ANSWER,
      headers: {
        [EVAL_ONBOARDING_MODE_HEADER]: EVAL_FIRST_MAKING_MODE_HEADER_VALUE,
      },
    });

    turn.expectOk();
    turn.notCalledTool("load_skill");
    turn.calledTool("start_first_making", { count: 1 });

    const toolNames = turn.toolCalls.map((call) => call.name);
    const makingIndex = toolNames.indexOf("start_first_making");
    const checklistIndex = toolNames.indexOf("start_checklist");
    if (checklistIndex !== -1 && checklistIndex < makingIndex) {
      throw new Error(
        `start_checklist ran before start_first_making: ${toolNames.join(", ")}`,
      );
    }

    const making = turn.requireToolCall("start_first_making");
    if (
      making.status !== "completed" ||
      !making.output ||
      typeof making.output !== "object" ||
      !("started" in making.output) ||
      making.output.started !== true
    ) {
      throw new Error(
        `first making did not start durably: ${JSON.stringify({
          status: making.status,
          output: making.output,
        })}`,
      );
    }
    if (making.input.childId !== EVAL_FIRST_MAKING_FIXTURE_CHILD_ID) {
      throw new Error(
        `first making targeted the wrong child: ${JSON.stringify(making.input)}`,
      );
    }
    if (making.input.herWords !== INTEREST_ANSWER) {
      throw new Error(
        `first making did not preserve Sidney's exact words: ${JSON.stringify(making.input)}`,
      );
    }
  },
});
