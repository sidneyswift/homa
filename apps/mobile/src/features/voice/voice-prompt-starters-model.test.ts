import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  VOICE_PROMPT_STARTERS,
  voicePromptStartersVisible,
} from "./voice-prompt-starters-model";

const ready = {
  status: "listening",
  turnActive: false,
  assistantHasReplied: true,
  userHasReplied: false,
  overlayOpen: false,
  retired: false,
} as const;

describe("native Voice prompt starters", () => {
  it("offers the four founder-requested tasks in making-then-organizing order", () => {
    assert.deepEqual(
      VOICE_PROMPT_STARTERS.map(({ label }) => label),
      [
        "Create a worksheet",
        "Make a lesson plan",
        "Open planner",
        "Log a lesson",
      ],
    );
  });

  it("opens the planner directly and starts the other tasks as Voice requests", () => {
    assert.deepEqual(VOICE_PROMPT_STARTERS[2].action, {
      kind: "route",
      href: "/planner",
    });
    assert.equal(VOICE_PROMPT_STARTERS[0].action.kind, "request");
    assert.equal(VOICE_PROMPT_STARTERS[1].action.kind, "request");
    assert.equal(VOICE_PROMPT_STARTERS[3].action.kind, "request");
  });

  it("appears after Homa's opening greeting while Voice is listening", () => {
    assert.equal(voicePromptStartersVisible(ready), true);
    assert.equal(
      voicePromptStartersVisible({ ...ready, assistantHasReplied: false }),
      false,
    );
    assert.equal(
      voicePromptStartersVisible({ ...ready, status: "speaking" }),
      false,
    );
    assert.equal(
      voicePromptStartersVisible({ ...ready, turnActive: true }),
      false,
    );
  });

  it("retires after a parent turn or card tap and stays out of overlays", () => {
    assert.equal(
      voicePromptStartersVisible({ ...ready, userHasReplied: true }),
      false,
    );
    assert.equal(
      voicePromptStartersVisible({ ...ready, retired: true }),
      false,
    );
    assert.equal(
      voicePromptStartersVisible({ ...ready, overlayOpen: true }),
      false,
    );
  });
});
