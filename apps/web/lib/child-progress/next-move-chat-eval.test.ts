import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chatNextMoveFindings, fullAssistantReply, type ChatNextMoveResult } from "../../evals/progress-next-move/chat-harness";
import { CUT_CURVES, NEXT_MOVE_CHILD, NEXT_MOVE_NOW, nextMoveChatScenario, postSaveProgressReceipt } from "../../evals/progress-next-move/chat-fixture";

function result(): ChatNextMoveResult {
  return { scenario: "fresh_motor", text: "Synthetic reviewed reply.", judgeFindings: [], calls: [
    { name: "load_skill", input: { skill: "progress-next-move" }, output: {} },
    { name: "explore_child_map", input: { query: "saved_answers", childId: NEXT_MOVE_CHILD, subjectId: "fine_motor" }, output: {} },
    { name: "verify_progress_next_move", input: { childId: NEXT_MOVE_CHILD, decision:{kind:"activity", targetItemId: CUT_CURVES} }, output: { verified: true, nextMove:{} } },
  ] };
}

describe("Chat next-move eval structural calibration", () => {
  it("post-save uses a current observation and a real Progress receipt shape", () => {
    const receipt = postSaveProgressReceipt();
    assert.equal(receipt.kind, "progress_update");
    assert.equal(receipt.childName, "Maya");
    assert.equal(receipt.affectedTopics.length, 1);
    assert.equal(nextMoveChatScenario("post_save_offer").ledger.evidence[0]?.observedAt, NEXT_MOVE_NOW.toISOString());
  });
  it("retains earlier streamed advice even when the final step is a supported stop", () => {
    assert.equal(fullAssistantReply([{text:"Try braiding today."},{text:""},{text:"No scissors drill needed."}]),
      "Try braiding today.\n\nNo scissors drill needed.");
  });
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
  it("distinguishes a verified stop from accepted practice without ignoring semantic failures", () => {
    const value = result(); value.scenario = "all_easy";
    value.calls[2] = {name:"verify_progress_next_move", input:{childId:NEXT_MOVE_CHILD, decision:{kind:"all_easy_stop", subjectId:"fine_motor"}}, output:{verified:true, stop:{kind:"all_saved_skills_easy"}}};
    assert.deepEqual(chatNextMoveFindings(value), []);
    value.judgeFindings = ["The reply adds cutting crafts after its stop."];
    assert.deepEqual(chatNextMoveFindings(value), value.judgeFindings);
  });
  it("preserves the semantic judge's failure rather than replacing it with tool success", () => {
    const value = result(); value.judgeFindings = ["The reply invented a second activity."];
    assert.deepEqual(chatNextMoveFindings(value), value.judgeFindings);
  });
});
