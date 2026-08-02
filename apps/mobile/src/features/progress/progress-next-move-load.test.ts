import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type {
  ChildProgressView,
  ProgressNextMoveResponse,
} from "@homa/core";

import {
  createProgressNextMoveRequestGate,
  loadProgressNextMoveRequest,
  progressNextMoveRequestKey,
  settleDismissedProgressNextMove,
  type ProgressNextMoveSnapshot,
} from "./progress-next-move-load";

const FINGERPRINT = "a".repeat(64);

function view(
  childId: string,
  overrides: Partial<ChildProgressView> = {},
): ChildProgressView {
  return {
    childId,
    childName: childId,
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
    ...overrides,
  };
}

function response(progressView: ChildProgressView): ProgressNextMoveResponse {
  return {
    ok: true,
    status: "settled",
    contextFingerprint: FINGERPRINT,
    sourceRevision: "7",
    view: progressView,
    nextMove: {
      kind: "none",
      childId: progressView.childId,
      sourceRevision: "7",
      reason: "producer_stopped",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

describe("Progress next-move request gate", () => {
  it("commits only a response for the visible semantic projection", async () => {
    const visible = view("child-maya");
    const gate = createProgressNextMoveRequestGate();
    let state: ProgressNextMoveSnapshot = {
      requestKey: null,
      response: null,
      loading: false,
      error: null,
    };
    await loadProgressNextMoveRequest({
      view: visible,
      gate,
      load: async () => response(visible),
      commit: (update) => {
        state = update(state);
      },
    });

    assert.equal(state.response?.view.childId, "child-maya");
    assert.equal(state.error, null);
  });

  it("rejects a same-child response whose Progress evidence changed", async () => {
    const visible = view("child-maya");
    const changed = view("child-maya", {
      scores: { ...visible.scores, observationCount: 1 },
    });
    const gate = createProgressNextMoveRequestGate();
    let state: ProgressNextMoveSnapshot = {
      requestKey: null,
      response: null,
      loading: false,
      error: null,
    };
    await loadProgressNextMoveRequest({
      view: visible,
      gate,
      load: async () => response(changed),
      commit: (update) => {
        state = update(state);
      },
    });

    assert.equal(state.response, null);
    assert.deepEqual(state.error, {
      kind: "invalid",
      message:
        "Progress changed while Homa was choosing. Refresh to see what’s current.",
      reason: "projection-changed",
    });
  });

  it("ignores child A when child B becomes visible before A returns", async () => {
    const a = deferred<ProgressNextMoveResponse>();
    const b = deferred<ProgressNextMoveResponse>();
    const gate = createProgressNextMoveRequestGate();
    let state: ProgressNextMoveSnapshot = {
      requestKey: null,
      response: null,
      loading: false,
      error: null,
    };
    const commit = (
      update: (current: ProgressNextMoveSnapshot) => ProgressNextMoveSnapshot,
    ) => {
      state = update(state);
    };
    const requestA = loadProgressNextMoveRequest({
      view: view("a"),
      gate,
      load: async () => await a.promise,
      commit,
    });
    const requestB = loadProgressNextMoveRequest({
      view: view("b"),
      gate,
      load: async () => await b.promise,
      commit,
    });

    a.resolve(response(view("a")));
    await requestA;
    assert.equal(state.response, null);
    b.resolve(response(view("b")));
    await requestB;
    assert.equal(state.response?.view.childId, "b");
  });

  it("clears a failed response and forwards an explicit retry before settling", async () => {
    const visible = view("child-maya");
    const gate = createProgressNextMoveRequestGate();
    const late = deferred<ProgressNextMoveResponse>();
    let receivedRetry = false;
    let state: ProgressNextMoveSnapshot = {
      requestKey: progressNextMoveRequestKey(visible),
      response: {
        ok: true,
        status: "failed",
        contextFingerprint: FINGERPRINT,
        sourceRevision: "7",
        view: visible,
        reason: "producer_unavailable",
      },
      loading: false,
      error: null,
    };
    const request = loadProgressNextMoveRequest({
      view: visible,
      gate,
      retryFailed: true,
      load: async (_childId, options) => {
        receivedRetry = options?.retryFailed === true;
        return await late.promise;
      },
      commit: (update) => {
        state = update(state);
      },
    });

    assert.equal(receivedRetry, true);
    assert.equal(state.loading, true);
    assert.equal(state.response, null);

    late.resolve(response(visible));
    await request;
    assert.equal(state.loading, false);
    assert.equal(state.response?.status, "settled");
  });
});

describe("Progress next-move dismissal transition", () => {
  it("settles only the exact visible child and fingerprint", () => {
    const visible = view("child-maya");
    const current: ProgressNextMoveSnapshot = {
      requestKey: progressNextMoveRequestKey(visible),
      response: response(visible),
      loading: false,
      error: null,
    };

    const settled = settleDismissedProgressNextMove({
      current,
      requestKey: progressNextMoveRequestKey(visible),
      contextFingerprint: FINGERPRINT,
      childId: visible.childId,
    });

    assert.equal(settled.response?.status, "settled");
    assert.equal(
      settled.response?.status === "settled"
        ? settled.response.nextMove.kind
        : null,
      "none",
    );
  });

  it("ignores an old child's dismissal after another child is visible", () => {
    const visible = view("child-b");
    const current: ProgressNextMoveSnapshot = {
      requestKey: progressNextMoveRequestKey(visible),
      response: response(visible),
      loading: false,
      error: null,
    };

    const settled = settleDismissedProgressNextMove({
      current,
      requestKey: progressNextMoveRequestKey(view("child-a")),
      contextFingerprint: FINGERPRINT,
      childId: "child-a",
    });

    assert.equal(settled, current);
    assert.equal(settled.response?.view.childId, "child-b");
  });

  it("ignores a stale fingerprint for the same Progress view", () => {
    const visible = view("child-maya");
    const current: ProgressNextMoveSnapshot = {
      requestKey: progressNextMoveRequestKey(visible),
      response: response(visible),
      loading: false,
      error: null,
    };

    const settled = settleDismissedProgressNextMove({
      current,
      requestKey: progressNextMoveRequestKey(visible),
      contextFingerprint: "b".repeat(64),
      childId: visible.childId,
    });

    assert.equal(settled, current);
  });
});

describe("Progress next-move presentation contract", () => {
  const cardSource = readFileSync(
    new URL("./progress-next-move-card.tsx", import.meta.url),
    "utf8",
  );
  const screenSource = readFileSync(
    new URL("../../app/(tabs)/progress.tsx", import.meta.url),
    "utf8",
  );

  it("shows source before advice and offers only editable Chat or dismissal", () => {
    assert.match(cardSource, /nextMove\.evidence\.map\(\(row\) => row\.receipt\)/u);
    assert.match(cardSource, /Adjust in Chat/u);
    assert.match(cardSource, /Answer in Chat/u);
    assert.match(cardSource, /Nothing sends until you tap Send/u);
    assert.match(cardSource, /Not today/u);
    assert.match(cardSource, /minHeight: 44/u);
    assert.doesNotMatch(cardSource, /onRegenerate|Try another|Do it now/u);
  });

  it("keeps subjects available while the optional idea is pending", () => {
    assert.match(screenSource, /Choosing one small next move/u);
    assert.match(screenSource, /visibleView\?\.subjects\.map/u);
    assert.match(screenSource, /progressNextMoveFingerprint/u);
    assert.match(screenSource, /review_progress_next_move/u);
    assert.match(screenSource, /nextMoveState\.retry\(\)/u);
    assert.match(screenSource, /Try again/u);
  });
});
