import { defineEval } from "eve/evals";
import type { EveEvalTurn } from "eve/evals";

function assertClarifiedWithoutWriting(turn: EveEvalTurn) {
  turn.notCalledTool("record_planner_activity");
  turn.notCalledTool("complete_planner_activity");
  turn.notCalledTool("manage_child_progress");

  const askedQuestion = turn.message?.includes("?")
    || turn.toolCalls.some((call) =>
      ["ask_question", "ask_user_questions"].includes(call.name));
  if (!askedQuestion) {
    throw new Error(
      `Homa changed nothing, but did not ask for the missing detail: ${JSON.stringify(turn.message)}`,
    );
  }
}

/**
 * The Planner skill owns completed-learning recaps, including the decision to
 * stop when a safe exact record cannot yet be proposed. Each case isolates one
 * required identity field so a broad "something was ambiguous" gate cannot
 * hide a child, date, or activity regression.
 */
const ambiguousLearningLogEvals = [
  defineEval({
    description:
      "A completed-learning recap with an unclear child asks once and writes nothing.",
    async test(t) {
      const turn = await t.send(
        "She finished the volcano experiment today. Please log it.",
      );
      assertClarifiedWithoutWriting(turn);
    },
  }),
  defineEval({
    description:
      "A completed-learning recap without an exact date asks once and writes nothing.",
    async test(t) {
      const turn = await t.send(
        "Maya finished the volcano experiment sometime last week. Please log it.",
      );
      assertClarifiedWithoutWriting(turn);
    },
  }),
  defineEval({
    description:
      "A completed-learning recap without an identifiable activity asks once and writes nothing.",
    async test(t) {
      const turn = await t.send("Maya finished it today. Please log it.");
      assertClarifiedWithoutWriting(turn);
    },
  }),
];

export default ambiguousLearningLogEvals;
