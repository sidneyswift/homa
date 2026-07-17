import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executePromptSuggestionLifecycleAction,
  promptSuggestionActionForLifecycleEvent,
  type PromptSuggestionLifecycleEvent,
} from "./prompt-suggestion-lifecycle";

describe("prompt suggestion recovery lifecycle", () => {
  it("recovers an auto-stopped turn instead of requesting from its snapshot", () => {
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "turn_finished",
        hasError: false,
        autoStopped: true,
        hasQueuedFollowup: false,
      }),
      "start_recovery",
    );
  });

  it("keeps a queued follow-up ahead of auto-stop recovery", () => {
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "turn_finished",
        hasError: false,
        autoStopped: true,
        hasQueuedFollowup: true,
      }),
      "clear",
    );
  });

  it("requests normally finished and successfully recovered messages", () => {
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "turn_finished",
        hasError: false,
        autoStopped: false,
        hasQueuedFollowup: false,
      }),
      "request_messages",
    );
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "recovery_finished",
        outcome: "recovered",
      }),
      "request_messages",
    );
  });

  it("clears when recovery starts and never requests after failure or abort", () => {
    assert.equal(
      promptSuggestionActionForLifecycleEvent({ type: "recovery_started" }),
      "clear",
    );
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "recovery_finished",
        outcome: "failed",
      }),
      "none",
    );
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "recovery_finished",
        outcome: "aborted",
      }),
      "none",
    );
  });

  it("does nothing for a failed turn before recovery begins", () => {
    assert.equal(
      promptSuggestionActionForLifecycleEvent({
        type: "turn_finished",
        hasError: true,
        autoStopped: false,
        hasQueuedFollowup: false,
      }),
      "none",
    );
  });

  it("executes finish and every recovery transition through one handler set", () => {
    const calls: string[] = [];
    const handlers = {
      clear: () => calls.push("clear"),
      requestMessages: (messages: readonly string[]) => {
        calls.push(`request:${messages.join(",")}`);
      },
      startRecovery: () => calls.push("start_recovery"),
    };
    const executeEvent = (
      event: PromptSuggestionLifecycleEvent,
      messages: readonly string[] | null,
    ) => {
      executePromptSuggestionLifecycleAction(
        promptSuggestionActionForLifecycleEvent(event),
        messages,
        handlers,
      );
    };

    executeEvent(
      {
        type: "turn_finished",
        hasError: false,
        autoStopped: true,
        hasQueuedFollowup: false,
      },
      ["partial"],
    );
    executeEvent({ type: "recovery_started" }, null);
    executeEvent(
      { type: "recovery_finished", outcome: "recovered" },
      ["final"],
    );
    executeEvent(
      { type: "recovery_finished", outcome: "failed" },
      null,
    );
    executeEvent(
      { type: "recovery_finished", outcome: "aborted" },
      null,
    );

    assert.deepEqual(calls, [
      "start_recovery",
      "clear",
      "request:final",
    ]);
  });
});
