import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chatNextMoveFindings, type ChatNextMoveResult } from "../../evals/progress-next-move/chat-harness";
import { CUT_CURVES, NEXT_MOVE_CHILD } from "../../evals/progress-next-move/chat-fixture";

function result(): ChatNextMoveResult {
  return { scenario: "fresh_motor", text: "Synthetic reviewed reply.", judgeFindings: [], calls: [
    { name: "load_skill", input: { skill: "progress-next-move" }, output: {} },
    { name: "explore_child_map", input: { query: "subject_map", childId: NEXT_MOVE_CHILD, subjectId: "fine_motor" }, output: {} },
    { name: "verify_progress_next_move", input: { childId: NEXT_MOVE_CHILD, targetItemId: CUT_CURVES }, output: { verified: true } },
  ] };
}

describe("Chat next-move eval structural calibration", () => {
  it("recognizes an ordered accepted canonical chain", () => assert.deepEqual(chatNextMoveFindings(result()), []));
  it("does not count a rejected verifier call as success", () => {
    const value = result(); value.calls[2]!.output = { verified: false };
    assert.ok(chatNextMoveFindings(value).length);
  });
  it("rejects verify-before-read, wrong-subject reads and an absent reader", () => {
    for (const mutate of [
      (v: ChatNextMoveResult) => v.calls.reverse(),
      (v: ChatNextMoveResult) => { v.calls[1]!.input.subjectId = "math"; },
      (v: ChatNextMoveResult) => { v.calls.splice(1, 1); },
    ]) { const value = result(); mutate(value); assert.ok(chatNextMoveFindings(value).length); }
  });
  it("rejects accepted advice on a stop case and unrelated effects", () => {
    const value = result(); value.scenario = "all_easy";
    assert.ok(chatNextMoveFindings(value).length);
    value.scenario = "fresh_motor"; value.calls.push({ name: "edit_plan", input: {}, output: { refused: true } });
    assert.ok(chatNextMoveFindings(value).length);
  });
  it("preserves the semantic judge's failure rather than replacing it with tool success", () => {
    const value = result(); value.judgeFindings = ["The reply invented a second activity."];
    assert.deepEqual(chatNextMoveFindings(value), value.judgeFindings);
  });
});
