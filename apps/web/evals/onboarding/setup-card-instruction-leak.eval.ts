import { gateway } from "ai";
import { defineEval } from "eve/evals";

import { HOMA_MODEL } from "../../agent/model";
import { messageSourceHeaders } from "../../lib/chat-message-source";
import {
  EVAL_ONBOARDING_MODE_HEADER,
  EVAL_ONBOARDING_MODE_HEADER_VALUE,
} from "../../lib/family-context-eval-fixture";

const SETUP_CARD_ANSWER =
  "Sidney, District of Columbia · Eclectic, Project-based learning";

/**
 * Regression for gh#415. The app saves both setup cards through authenticated
 * routes, joins their display summaries, and opens the first child card before
 * this model turn completes. Homa should react to the parent, not narrate an
 * instruction to herself or try to operate cards the app already owns.
 */
export default defineEval({
  description:
    "The combined setup-card answer gets a brief parent-facing reaction without instruction leakage or duplicate card tools.",
  tags: ["model-backed", "onboarding"],
  judge: {
    model: gateway(HOMA_MODEL),
    modelOptions: {
      providerOptions: {
        gateway: {
          disallowPromptTraining: true,
          tags: ["onboarding_setup_card_instruction_leak_eval"],
        },
      },
    },
  },
  timeoutMs: 120_000,
  async test(t) {
    const turn = await t.send({
      message: SETUP_CARD_ANSWER,
      headers: {
        ...messageSourceHeaders("saved_card_answer"),
        [EVAL_ONBOARDING_MODE_HEADER]: EVAL_ONBOARDING_MODE_HEADER_VALUE,
      },
    });

    turn.expectOk();
    turn.notCalledTool("load_skill");
    turn.notCalledTool("save_family_basics");
    turn.notCalledTool("save_homeschool_profile");
    turn.notCalledTool("add_child");
    turn.notCalledTool("ask_for_details");

    const reply = (turn.message ?? "").trim();
    if (!reply) {
      throw new Error("the setup-card answer produced no visible reaction");
    }

    const leakedPhrases = [
      "react briefly",
      "hand it straight",
      "her kids",
    ].filter((phrase) => reply.toLowerCase().includes(phrase));
    if (leakedPhrases.length > 0) {
      throw new Error(
        `the reply leaked internal instruction language: ${leakedPhrases.join(", ")}`,
      );
    }

    t.log(reply);
    t.judge.autoevals
      .closedQA(
        [
          "The reply speaks directly to the parent in second person or by the name Sidney.",
          "It briefly reacts to Sidney's location or homeschool approach.",
          "It does not mention an app, cards, setup, steps, or instructions.",
          "It does not speak about the parent in third person or tell Homa what to do next.",
        ].join(" "),
      )
      .gate();
  },
});
