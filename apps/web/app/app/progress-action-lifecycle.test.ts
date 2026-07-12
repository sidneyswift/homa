import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  beginProgressAction,
  createProgressActionLifecycleState,
  progressActionUnavailableKeys,
  releaseProgressAction,
  settleProgressAction,
} from "./progress-action-lifecycle";

const ACTION_KEY =
  "progress-card:session-1:turn_1:assistant:0";

describe("progress card action consumption lifecycle", () => {
  it("keeps a wall-rejected action retryable", () => {
    const started = beginProgressAction(
      createProgressActionLifecycleState(),
      ACTION_KEY,
    );
    assert.equal(started.accepted, true);

    const rejected = settleProgressAction(
      started.state,
      ACTION_KEY,
      "rejected",
    );
    assert.equal(
      progressActionUnavailableKeys(rejected).has(ACTION_KEY),
      false,
    );
    assert.equal(
      beginProgressAction(rejected, ACTION_KEY).accepted,
      true,
    );
  });

  it("releases a cancelled queued action so it can be retried", () => {
    const started = beginProgressAction(
      createProgressActionLifecycleState(),
      ACTION_KEY,
    );
    const queued = settleProgressAction(
      started.state,
      ACTION_KEY,
      "queued",
    );
    assert.equal(
      progressActionUnavailableKeys(queued).has(ACTION_KEY),
      true,
    );

    const cancelled = releaseProgressAction(queued, ACTION_KEY);

    assert.equal(
      beginProgressAction(cancelled, ACTION_KEY).accepted,
      true,
    );
  });

  it("keeps a successful immediate send consumed", () => {
    const started = beginProgressAction(
      createProgressActionLifecycleState(),
      ACTION_KEY,
    );
    const sent = settleProgressAction(
      started.state,
      ACTION_KEY,
      "sent",
    );

    assert.equal(beginProgressAction(sent, ACTION_KEY).accepted, false);
  });

  it("keeps a queued action consumed after flush", () => {
    const started = beginProgressAction(
      createProgressActionLifecycleState(),
      ACTION_KEY,
    );
    const flushed = settleProgressAction(
      started.state,
      ACTION_KEY,
      "queued",
    );

    assert.equal(
      beginProgressAction(flushed, ACTION_KEY).accepted,
      false,
    );
  });

  it("rejects a repeated click while the first action is pending", () => {
    const initial = createProgressActionLifecycleState();
    const first = beginProgressAction(initial, ACTION_KEY);
    const repeated = beginProgressAction(first.state, ACTION_KEY);

    assert.equal(first.accepted, true);
    assert.equal(repeated.accepted, false);
  });
});
