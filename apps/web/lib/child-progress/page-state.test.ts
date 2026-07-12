import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadChildProgressPageState,
} from "./page-state";

const INPUT = {
  familyId: "family-1",
  child: {
    id: "child-1",
    name: "Maya",
    birthDate: "2019-07-01",
  },
  timeZone: "America/Chicago",
  now: new Date("2026-07-12T06:00:00.000Z"),
};

describe("live Progress page state", () => {
  it("returns an unavailable state without a fallback redirect when the read throws", async () => {
    const readError = new Error("progress table unavailable");
    const state = await loadChildProgressPageState(
      INPUT,
      {
        loadView: async () => {
          throw readError;
        },
      },
    );

    assert.deepEqual(state, {
      status: "unavailable",
      error: readError,
    });
    assert.equal("redirectTo" in state, false);
  });

  it("builds the normal empty view when no live row or report exists", async () => {
    const state = await loadChildProgressPageState(
      INPUT,
      { loadView: async () => null },
    );

    assert.equal(state.status, "ready");
    if (state.status !== "ready") {
      throw new Error("Expected a ready empty view");
    }
    assert.equal(state.view.childId, INPUT.child.id);
    assert.equal(state.view.childName, INPUT.child.name);
    assert.equal(state.view.birthDate, INPUT.child.birthDate);
    assert.equal(state.view.timeZone, INPUT.timeZone);
    assert.deepEqual(state.view.subjects, []);
    assert.deepEqual(state.view.conflicts, []);
    assert.equal(state.view.scores.observationCount, 0);
    assert.equal("report" in state.view, false);
    assert.equal("token" in state.view, false);
  });
});
