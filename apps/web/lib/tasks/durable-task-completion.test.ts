import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emitDurableTaskRunCompletion } from "./store";

describe("durable generic task completion events", () => {
  it("emits one failed completion for no-output and none on replay", async () => {
    const events: Array<{ name: string; props: object }> = [];
    const emit = async (name: string, props: object) => {
      events.push({ name, props });
    };
    await emitDurableTaskRunCompletion(
      { familyId: "family-1", kind: "custom" },
      {
        finished: true,
        delivery: {
          status: "failed",
          deliveredChannel: null,
          deliveredCount: 0,
          failedCount: 0,
        },
      },
      emit,
    );
    await emitDurableTaskRunCompletion(
      { familyId: "family-1", kind: "custom" },
      { finished: false, delivery: null },
      emit,
    );
    assert.deepEqual(events, [{
      name: "tasks.run_completed",
      props: {
        family_id: "family-1",
        kind: "custom",
        status: "failed",
      },
    }]);
  });
});
