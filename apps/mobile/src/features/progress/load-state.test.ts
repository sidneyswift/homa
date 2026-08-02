import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChildProgressView } from "../../lib/child-progress";
import {
  completeProgressLoad,
  createProgressLoadState,
  failProgressLoad,
  startProgressLoad,
  visibleProgressLoadState,
} from "./load-state";

function view(childId: string, childName: string): ChildProgressView {
  return {
    childId,
    childName,
    birthDate: "2020-01-01",
    timeZone: "America/New_York",
    projectedAt: "2026-08-02T00:00:00.000Z",
    scores: {} as ChildProgressView["scores"],
    subjects: [],
    conflicts: [],
  };
}

describe("native Progress load coordination", () => {
  it("masks A immediately and ignores A when B wins", () => {
    let state = startProgressLoad(createProgressLoadState(null), "a", 1);
    state = completeProgressLoad(state, "a", 1, view("a", "Ava"));

    assert.equal(visibleProgressLoadState(state, "b").view, null);
    state = startProgressLoad(state, "b", 2);
    const waitingForB = state;

    state = completeProgressLoad(state, "a", 1, view("a", "Ava"));
    assert.strictEqual(state, waitingForB);

    state = completeProgressLoad(state, "b", 2, view("b", "Bea"));
    assert.equal(state.view?.childId, "b");
    assert.equal(state.loading, false);
  });

  it("accepts only the newest A request across A to B to A", () => {
    let state = startProgressLoad(createProgressLoadState(null), "a", 1);
    state = startProgressLoad(state, "b", 2);
    state = startProgressLoad(state, "a", 3);
    const newestA = state;

    assert.strictEqual(
      completeProgressLoad(state, "b", 2, view("b", "Bea")),
      newestA,
    );
    assert.strictEqual(
      completeProgressLoad(state, "a", 1, view("a", "Old Ava")),
      newestA,
    );

    state = completeProgressLoad(state, "a", 3, view("a", "Ava"));
    assert.equal(state.view?.childName, "Ava");
  });

  it("represents a missing projection as a complete empty result", () => {
    let state = startProgressLoad(createProgressLoadState(null), "a", 1);
    state = completeProgressLoad(state, "a", 1, null);

    assert.deepEqual(
      { childId: state.childId, view: state.view, loading: state.loading, error: state.error },
      { childId: "a", view: null, loading: false, error: null },
    );
  });

  it("keeps only same-child stale data after a rejection", () => {
    let state = startProgressLoad(createProgressLoadState(null), "a", 1);
    state = completeProgressLoad(state, "a", 1, view("a", "Ava"));
    state = startProgressLoad(state, "a", 2);
    state = failProgressLoad(state, "a", 2, "offline");

    assert.equal(state.view?.childId, "a");
    assert.equal(state.error, "offline");
    assert.equal(state.loading, false);

    state = startProgressLoad(state, "b", 3);
    assert.equal(state.view, null);
    assert.equal(state.error, null);
  });

  it("clears an error on retry and commits the retry result", () => {
    let state = startProgressLoad(createProgressLoadState(null), "a", 1);
    state = failProgressLoad(state, "a", 1, "server error");
    state = startProgressLoad(state, "a", 2);

    assert.equal(state.loading, true);
    assert.equal(state.error, null);

    state = completeProgressLoad(state, "a", 2, view("a", "Ava"));
    assert.equal(state.view?.childId, "a");
    assert.equal(state.loading, false);
  });

  it("rejects a projection whose embedded child does not match the request", () => {
    let state = startProgressLoad(createProgressLoadState(null), "a", 1);
    state = completeProgressLoad(state, "a", 1, view("b", "Bea"));

    assert.equal(state.view, null);
    assert.match(state.error ?? "", /different child/u);
  });
});
