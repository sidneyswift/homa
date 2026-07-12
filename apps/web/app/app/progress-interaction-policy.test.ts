import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage } from "eve/react";

import {
  latestProgressMessageInteraction,
} from "./progress-interaction-policy";

const CHECK_IN_ID = "11111111-1111-4111-8111-111111111111";
const UNDO_TOKEN = "33333333-3333-4333-8333-333333333333";

function assistantProgressMessage(
  id: string,
  output: unknown,
): EveMessage {
  return assistantProgressParts(id, [progressPart(output)]);
}

function progressPart(
  output: unknown,
  state = "output-available",
) {
  return {
    type: "dynamic-tool",
    state,
    toolName: "manage_child_progress",
    output,
  };
}

function assistantProgressParts(
  id: string,
  parts: unknown[],
): EveMessage {
  return {
    id,
    role: "assistant",
    parts,
  } as unknown as EveMessage;
}

function userMessage(id: string, text: string): EveMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  } as unknown as EveMessage;
}

function questionOutput(statement: string) {
  return {
    kind: "progress_question",
    prompt: {
      checkInId: CHECK_IN_ID,
      revision: 1,
      childName: "Maya",
      subjectDisplayName: "Math",
      statement,
      answerOptions: [
        "easily",
        "getting_there",
        "not_yet",
        "not_sure",
        "skip",
      ],
    },
  };
}

function updateOutput() {
  return {
    kind: "progress_update",
    label: "Progress updated",
    childName: "Maya",
    affectedTopics: ["Counts out loud from 1 to 5"],
    undoAvailable: true,
    undoToken: UNDO_TOKEN,
  };
}

describe("latestProgressMessageInteraction", () => {
  it("enables only the latest of two live actionable progress messages", () => {
    const first = assistantProgressMessage(
      "turn_1:assistant",
      questionOutput("Can Maya count to 5?"),
    );
    const second = assistantProgressMessage(
      "turn_2:assistant",
      updateOutput(),
    );

    assert.deepEqual(
      latestProgressMessageInteraction({
        messages: [first, second],
        sessionKey: "session-1",
        unavailableActionKeys: new Set(),
      }),
      {
        messageId: "turn_2:assistant",
        partIndex: 0,
        partKey: "turn_2:assistant:0",
        actionKey: "progress-card:session-1:turn_2:assistant:0",
      },
    );
  });

  it("disables a progress card after a later user message", () => {
    const card = assistantProgressMessage(
      "turn_1:assistant",
      questionOutput("Can Maya count to 5?"),
    );

    assert.equal(
      latestProgressMessageInteraction({
        messages: [card, userMessage("turn_2:user", "Tell me about reading")],
        sessionKey: "session-1",
        unavailableActionKeys: new Set(),
      }),
      null,
    );
  });

  it("keeps a consumed card disabled and enables a new assistant card", () => {
    const first = assistantProgressMessage(
      "turn_1:assistant",
      questionOutput("Can Maya count to 5?"),
    );
    const firstKey =
      "progress-card:session-1:turn_1:assistant:0";
    const consumed = new Set([firstKey]);

    assert.equal(
      latestProgressMessageInteraction({
        messages: [first],
        sessionKey: "session-1",
        unavailableActionKeys: consumed,
      }),
      null,
    );

    const second = assistantProgressMessage(
      "turn_2:assistant",
      questionOutput("Can Maya count to 10?"),
    );
    assert.deepEqual(
      latestProgressMessageInteraction({
        messages: [first, second],
        sessionKey: "session-1",
        unavailableActionKeys: consumed,
      }),
      {
        messageId: "turn_2:assistant",
        partIndex: 0,
        partKey: "turn_2:assistant:0",
        actionKey: "progress-card:session-1:turn_2:assistant:0",
      },
    );
  });

  it("makes an earlier card stale after a read-only progress result", () => {
    const earlierQuestion = assistantProgressMessage(
      "turn_1:assistant",
      questionOutput("Can Maya count to 5?"),
    );
    const savedWithoutUpdate = assistantProgressMessage(
      "turn_2:assistant",
      {
        kind: "progress_workflow",
        label: "Check-in saved",
      },
    );

    assert.equal(
      latestProgressMessageInteraction({
        messages: [earlierQuestion, savedWithoutUpdate],
        sessionKey: "session-1",
        unavailableActionKeys: new Set(),
      }),
      null,
    );
  });

  it("enables only the latest actionable part in one assistant message", () => {
    const message = assistantProgressParts(
      "turn_1:assistant",
      [
        progressPart(questionOutput("Can Maya count to 5?")),
        { type: "text", text: "Next card" },
        progressPart(updateOutput()),
      ],
    );

    assert.deepEqual(
      latestProgressMessageInteraction({
        messages: [message],
        sessionKey: "session-1",
        unavailableActionKeys: new Set(),
      }),
      {
        messageId: "turn_1:assistant",
        partIndex: 2,
        partKey: "turn_1:assistant:2",
        actionKey: "progress-card:session-1:turn_1:assistant:2",
      },
    );
  });

  it("invalidates an earlier same-message card for a later in-flight progress part", () => {
    const message = assistantProgressParts(
      "turn_1:assistant",
      [
        progressPart(questionOutput("Can Maya count to 5?")),
        progressPart(undefined, "input-available"),
      ],
    );

    assert.equal(
      latestProgressMessageInteraction({
        messages: [message],
        sessionKey: "session-1",
        unavailableActionKeys: new Set(),
      }),
      null,
    );
  });
});
