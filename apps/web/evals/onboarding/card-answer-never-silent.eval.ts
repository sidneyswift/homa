import { defineEval } from "eve/evals";

import {
  EVAL_ONBOARDING_MODE_HEADER,
  EVAL_ONBOARDING_MODE_HEADER_VALUE,
} from "../../lib/family-context-eval-fixture";

/**
 * Regression for the 2026-07-28 onboarding dead end in issue #315.
 *
 * This opts into the dedicated active, childless sandbox family. The first
 * message takes the supported typed-past-the-card path and deliberately omits
 * the birthday, so Homa must put up the child details card. The next message
 * has the shape the real card posts after saving. That second turn is the one
 * that returned the empty-delivery sentinel again when the onboarding skill
 * was preloaded.
 */
export default defineEval({
  description:
    "An onboarding turn after a details card always produces visible text or another action.",
  async test(t) {
    const headers = {
      [EVAL_ONBOARDING_MODE_HEADER]: EVAL_ONBOARDING_MODE_HEADER_VALUE,
    };

    const cardTurn = await t.send({
      message:
        "I skipped the child card and typed here instead. My child is Mia. Can you put the card back up for me?",
      headers,
    });
    cardTurn.expectOk();
    const card = cardTurn.requireToolCall("ask_for_details");
    if (card.input.kind !== "child") {
      throw new Error(
        `expected the child details card, received ${JSON.stringify(card.input)}`,
      );
    }
    cardTurn.notCalledTool("load_skill");

    const answerTurn = await t.send({
      message:
        "[[homa:onboarding details_saved summary=Mia-born-April-12-2019-loves-dinosaurs-and-drawing]]",
      headers,
    });
    answerTurn.expectOk();
    answerTurn.notCalledTool("load_skill");

    const visibleText = (answerTurn.message ?? "").trim().length > 0;
    const actionCount = answerTurn.toolCalls.length;
    if (!visibleText && actionCount === 0) {
      throw new Error(
        "the turn after the details card completed with no visible text and no action",
      );
    }
  },
});
