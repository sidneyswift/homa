import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROGRESS_NEXT_MOVE_CHAT_CHILD_HEADER,
  PROGRESS_NEXT_MOVE_CHAT_FINGERPRINT_HEADER,
  type ProgressNextMove,
} from "@homa/core";

import {
  PROGRESS_NEXT_MOVE_CHAT_UNAVAILABLE,
  resolveProgressNextMoveChatContext,
  type ProgressNextMoveChatContextDependencies,
} from "./next-move-chat-context";
import type { ProgressNextMoveSnapshot } from "./next-move-snapshot";
import type { StoredProgressNextMove } from "./next-move-store";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";
const FINGERPRINT = "a".repeat(64);

function move(): Extract<ProgressNextMove, { kind: "move" }> {
  return {
    kind: "move",
    childId: CHILD_ID,
    sourceRevision: "7",
    targetItemId: "math.counts-to-5",
    targetStatement: "Counts up to 5 objects",
    minutes: 5,
    activity: "Count five spoons, then hide one and count what remains.",
    why: "Maya is still building confidence counting small groups.",
    evidence: [
      {
        evidenceId: "33333333-3333-4333-8333-333333333333",
        itemId: "math.counts-to-5",
        statement: "Counts up to 5 objects",
        answer: "getting_there",
        derivation: "direct",
        sourceKind: "check_in",
        adultDisplayName: "Elena",
        observedAt: "2026-08-01T16:00:00.000Z",
        receipt: "From Elena’s Aug 1 check-in answer",
      },
    ],
    chatDraft: "Help me adjust this for Maya.",
  };
}

function snapshot(
  overrides: Partial<ProgressNextMoveSnapshot> = {},
): ProgressNextMoveSnapshot {
  return {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    sourceRevision: BigInt(7),
    contextFingerprint: FINGERPRINT,
    view: {
      childId: CHILD_ID,
      childName: "Maya",
      birthDate: "2020-01-02",
      timeZone: "America/New_York",
      projectedAt: "2026-08-02T16:00:00.000Z",
      scores: {
        subjects: [],
        strengthOrder: [],
        mappedCount: 0,
        totalSubjects: 0,
        observationCount: 1,
      },
      subjects: [],
      conflicts: [],
    },
    ledger: null as never,
    context: null as never,
    clarification: null,
    ...overrides,
  };
}

function stored(
  overrides: Partial<StoredProgressNextMove> = {},
): StoredProgressNextMove {
  return {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    contextFingerprint: FINGERPRINT,
    sourceRevision: BigInt(7),
    status: "ready",
    nextMove: move(),
    runtimeSessionId: "session-1",
    updatedAt: "2026-08-02T16:00:00.000Z",
    ...overrides,
  };
}

function headers(
  childId = CHILD_ID,
  fingerprint = FINGERPRINT,
): Headers {
  return new Headers({
    [PROGRESS_NEXT_MOVE_CHAT_CHILD_HEADER]: childId,
    [PROGRESS_NEXT_MOVE_CHAT_FINGERPRINT_HEADER]: fingerprint,
  });
}

function dependencies(input: {
  snapshot?: ProgressNextMoveSnapshot | null;
  stored?: StoredProgressNextMove | null;
  calls?: string[];
} = {}): ProgressNextMoveChatContextDependencies {
  return {
    loadSnapshot: async () => {
      input.calls?.push("snapshot");
      return input.snapshot === undefined ? snapshot() : input.snapshot;
    },
    loadStored: async () => {
      input.calls?.push("stored");
      return input.stored === undefined ? stored() : input.stored;
    },
  };
}

describe("Progress next move to Chat redemption", () => {
  it("renders only the current authenticated stored proposal", async () => {
    const context = await resolveProgressNextMoveChatContext(
      { familyId: FAMILY_ID, headers: headers() },
      dependencies(),
    );

    assert.match(context ?? "", /^## Verified Progress proposal handoff/u);
    assert.match(context ?? "", /Count five spoons/u);
    assert.match(context ?? "", /From Elena’s Aug 1 check-in answer/u);
    assert.doesNotMatch(context ?? "", /chatDraft|private raw quote/u);
  });

  it("does no Progress read when the turn has no handoff headers", async () => {
    const calls: string[] = [];
    const context = await resolveProgressNextMoveChatContext(
      { familyId: FAMILY_ID, headers: new Headers() },
      dependencies({ calls }),
    );

    assert.equal(context, null);
    assert.deepEqual(calls, []);
  });

  it("fails closed for malformed, stale, foreign, or dismissed claims", async () => {
    assert.equal(
      await resolveProgressNextMoveChatContext(
        {
          familyId: FAMILY_ID,
          headers: new Headers({
            [PROGRESS_NEXT_MOVE_CHAT_CHILD_HEADER]: CHILD_ID,
          }),
        },
        dependencies(),
      ),
      PROGRESS_NEXT_MOVE_CHAT_UNAVAILABLE,
    );
    assert.equal(
      await resolveProgressNextMoveChatContext(
        { familyId: FAMILY_ID, headers: headers() },
        dependencies({
          snapshot: snapshot({ contextFingerprint: "b".repeat(64) }),
        }),
      ),
      PROGRESS_NEXT_MOVE_CHAT_UNAVAILABLE,
    );
    assert.equal(
      await resolveProgressNextMoveChatContext(
        { familyId: FAMILY_ID, headers: headers() },
        dependencies({
          stored: stored({
            familyId: "44444444-4444-4444-8444-444444444444",
          }),
        }),
      ),
      PROGRESS_NEXT_MOVE_CHAT_UNAVAILABLE,
    );
    assert.equal(
      await resolveProgressNextMoveChatContext(
        { familyId: FAMILY_ID, headers: headers() },
        dependencies({ stored: stored({ status: "dismissed" }) }),
      ),
      PROGRESS_NEXT_MOVE_CHAT_UNAVAILABLE,
    );
  });
});
