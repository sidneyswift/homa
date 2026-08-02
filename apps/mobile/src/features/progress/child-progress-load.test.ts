import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ChildProgressReadError } from "../../lib/child-progress-error";
import type { ChildProgressView } from "../../lib/child-progress";
import {
  createChildProgressRequestGate,
  loadChildProgressRequest,
  type ChildProgressSnapshot,
} from "./child-progress-load";

function view(childId: string, childName = childId): ChildProgressView {
  return {
    childId,
    childName,
    birthDate: "2020-01-02",
    timeZone: "America/New_York",
    projectedAt: "2026-08-02T12:00:00.000Z",
    scores: {
      subjects: [],
      strengthOrder: [],
      mappedCount: 0,
      totalSubjects: 0,
      observationCount: 0,
    },
    subjects: [],
    conflicts: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe("child-scoped Progress request gate", () => {
  it("masks A immediately and ignores A when B was selected later", async () => {
    const a = deferred<ChildProgressView>();
    const b = deferred<ChildProgressView>();
    const loads = new Map([
      ["a", a.promise],
      ["b", b.promise],
    ]);
    const gate = createChildProgressRequestGate();
    let state: ChildProgressSnapshot = {
      requestedChildId: "a",
      view: view("a", "Ava"),
      loading: false,
      error: null,
    };
    const commit = (update: (current: ChildProgressSnapshot) => ChildProgressSnapshot) => {
      state = update(state);
    };
    const load = (childId: string) => loads.get(childId) ?? Promise.reject(new Error("missing"));

    const requestA = loadChildProgressRequest({ childId: "a", gate, load, commit });
    const requestB = loadChildProgressRequest({ childId: "b", gate, load, commit });
    assert.equal(state.requestedChildId, "b");
    assert.equal(state.view, null);

    a.resolve(view("a", "Ava"));
    await requestA;
    assert.equal(state.requestedChildId, "b");
    assert.equal(state.view, null);

    b.resolve(view("b", "Ben"));
    await requestB;
    assert.equal(state.view?.childId, "b");
    assert.equal(state.loading, false);
  });

  it("allows only the newest A request through an A to B to A race", async () => {
    const firstA = deferred<ChildProgressView>();
    const b = deferred<ChildProgressView>();
    const lastA = deferred<ChildProgressView>();
    const queue = [firstA.promise, b.promise, lastA.promise];
    const gate = createChildProgressRequestGate();
    let state: ChildProgressSnapshot = {
      requestedChildId: null,
      view: null,
      loading: false,
      error: null,
    };
    const commit = (update: (current: ChildProgressSnapshot) => ChildProgressSnapshot) => {
      state = update(state);
    };
    const load = () => queue.shift() ?? Promise.reject(new Error("missing"));

    const one = loadChildProgressRequest({ childId: "a", gate, load, commit });
    const two = loadChildProgressRequest({ childId: "b", gate, load, commit });
    const three = loadChildProgressRequest({ childId: "a", gate, load, commit });
    b.resolve(view("b"));
    firstA.resolve(view("a", "Old Ava"));
    await Promise.all([one, two]);
    assert.equal(state.requestedChildId, "a");
    assert.equal(state.view, null);

    lastA.resolve(view("a", "Current Ava"));
    await three;
    assert.equal(state.view?.childName, "Current Ava");
  });

  it("keeps stale data only for recoverable failures and rejects mismatched data", async () => {
    const gate = createChildProgressRequestGate();
    let state: ChildProgressSnapshot = {
      requestedChildId: "a",
      view: view("a", "Ava"),
      loading: false,
      error: null,
    };
    const commit = (update: (current: ChildProgressSnapshot) => ChildProgressSnapshot) => {
      state = update(state);
    };

    await loadChildProgressRequest({
      childId: "a",
      gate,
      load: async () => {
        throw new Error("offline");
      },
      commit,
    });
    assert.equal(state.view?.childId, "a");
    assert.deepEqual(state.error, {
      kind: "transient",
      message: "offline",
      reason: null,
    });

    await loadChildProgressRequest({
      childId: "a",
      gate,
      load: async () => {
        throw new ChildProgressReadError(
          "authentication",
          "Your session needs to be refreshed.",
          401,
        );
      },
      commit,
    });
    assert.equal(state.view, null);
    assert.deepEqual(state.error, {
      kind: "authentication",
      message: "Your session needs to be refreshed.",
      reason: null,
    });

    state = {
      requestedChildId: "a",
      view: view("a", "Ava"),
      loading: false,
      error: null,
    };
    await loadChildProgressRequest({
      childId: "a",
      gate,
      load: async () => {
        throw new ChildProgressReadError(
          "invalid",
          "Progress could not be verified.",
          502,
        );
      },
      commit,
    });
    assert.equal(state.view, null);

    await loadChildProgressRequest({
      childId: "b",
      gate,
      load: async () => view("a"),
      commit,
    });
    assert.equal(state.requestedChildId, "b");
    assert.equal(state.view, null);
    assert.deepEqual(state.error, {
      kind: "invalid",
      message: "Progress could not be verified.",
      reason: null,
    });
  });
});
