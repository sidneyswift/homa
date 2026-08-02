import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildChildProgressView } from "./projection";
import type {
  ChildProgressProjectionInput,
  StoredProgressEvidence,
} from "./repository";
import type { OpenProgressConflict } from "./types";
import {
  buildProgressNextMoveModelContext,
  progressNextMoveClarification,
  verifyProgressNextMoveCandidate,
} from "./next-move";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-08-02T16:00:00.000Z");

function evidence(
  itemId: string,
  overrides: Partial<StoredProgressEvidence> = {},
): StoredProgressEvidence {
  return {
    id: `evidence-${itemId}`,
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId,
    answer: "getting_there",
    derivation: "direct",
    source: "check_in",
    memberUserId: "33333333-3333-4333-8333-333333333333",
    adultDisplayName: "Elena",
    quote: null,
    channel: "web",
    messageId: "message-1",
    checkInId: "check-in-1",
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-08-01T16:00:00.000Z",
    createdAt: "2026-08-01T16:00:01.000Z",
    idempotencyKey: `key-${itemId}`,
    ...overrides,
  };
}

function ledger(
  evidenceRows: StoredProgressEvidence[],
  overrides: Partial<ChildProgressProjectionInput> = {},
): ChildProgressProjectionInput {
  return {
    child: {
      id: CHILD_ID,
      name: "Maya",
      birthDate: "2020-01-02",
    },
    familyId: FAMILY_ID,
    timeZone: "America/New_York",
    sourceRevision: BigInt(7),
    evidence: evidenceRows,
    conflicts: [],
    selectionAnswers: [],
    ...overrides,
  };
}

function state(input: ChildProgressProjectionInput) {
  return {
    familyId: FAMILY_ID,
    ledger: input,
    view: buildChildProgressView({ ...input, now: NOW }),
    now: NOW,
  };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    childId: CHILD_ID,
    targetItemId: "math.counts-to-5",
    evidenceItemIds: ["math.counts-to-5"],
    minutes: 5,
    activity: "Count five spoons, then hide one and ask how many remain.",
    why: "Maya is still building confidence counting small groups.",
    ...overrides,
  };
}

function conflict(): OpenProgressConflict {
  return {
    id: "conflict-1",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    evidenceIdA: "evidence-a",
    evidenceIdB: "evidence-b",
    state: "open",
    resolvedAnswer: null,
    resolvedEvidenceId: null,
    observedAt: "2026-08-01T17:00:00.000Z",
    resolvedAt: null,
  };
}

describe("Progress next-move model boundary", () => {
  it("offers only fresh current getting-there or not-yet evidence as targets", () => {
    const current = ledger([
      evidence("math.counts-to-5", { answer: "not_yet" }),
      evidence("math.small-groups", { answer: "easily" }),
      evidence("phonics.single-letter-sounds", {
        answer: "getting_there",
        derivation: "unknown",
      }),
    ]);

    const context = buildProgressNextMoveModelContext(state(current));
    assert.deepEqual(
      context.allowedTargets.map((target) => target.itemId),
      ["math.counts-to-5"],
    );
    assert.equal(context.eligibleEvidence[0]?.receipt, "From Elena’s Aug 1 check-in answer");
  });

  it("returns no artificial target when every fresh answer is already easy", () => {
    const current = ledger([
      evidence("math.counts-to-5", { answer: "easily" }),
      evidence("math.small-groups", { answer: "easily" }),
    ]);
    const context = buildProgressNextMoveModelContext(state(current));

    assert.deepEqual(context.allowedTargets, []);
    assert.equal(progressNextMoveClarification(state(current)), null);
  });

  it("does not let stale or unknown evidence become a target beside fresh easy evidence", () => {
    const current = ledger([
      evidence("math.counts-to-5", { answer: "easily" }),
      evidence("math.small-groups", {
        answer: "not_yet",
        observedAt: "2026-05-01T16:00:00.000Z",
      }),
      evidence("phonics.single-letter-sounds", {
        answer: "not_yet",
        derivation: "unknown",
      }),
    ]);

    assert.deepEqual(buildProgressNextMoveModelContext(state(current)).allowedTargets, []);
  });

  it("builds a deterministic inferred-source receipt without exposing a raw quote", () => {
    const current = ledger([
      evidence("math.counts-to-5", {
        derivation: "inferred",
        source: "journal",
        adultDisplayName: null,
        checkInId: null,
        quote: "private raw wording",
      }),
    ]);
    const context = buildProgressNextMoveModelContext(state(current));

    assert.equal(
      context.eligibleEvidence[0]?.receipt,
      "From an Aug 1 journal note, matched by Homa",
    );
    assert.doesNotMatch(JSON.stringify(context), /private raw wording/u);
  });

  it("labels inferred evidence as Homa-matched even when an adult is named", () => {
    const current = ledger([
      evidence("math.counts-to-5", {
        derivation: "inferred",
        source: "journal",
        adultDisplayName: "Elena",
      }),
    ]);
    const context = buildProgressNextMoveModelContext(state(current));

    assert.equal(
      context.eligibleEvidence[0]?.receipt,
      "From Elena’s Aug 1 journal note, matched by Homa",
    );
  });
});

describe("Progress next-move deterministic verifier", () => {
  it("accepts one grounded current move and returns a source receipt", () => {
    const current = ledger([evidence("math.counts-to-5")]);
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate(),
    });

    assert.equal(result.accepted, true);
    if (!result.accepted) return;
    assert.equal(result.nextMove.targetItemId, "math.counts-to-5");
    assert.equal(
      result.nextMove.evidence[0]?.receipt,
      "From Elena’s Aug 1 check-in answer",
    );
    assert.match(result.nextMove.chatDraft, /^Help me adjust this for Maya:/u);
  });

  it("normalizes banned punctuation in legitimate family display names", () => {
    const current = ledger(
      [
        evidence("math.counts-to-5", {
          adultDisplayName: "Elena\u2014Mom",
        }),
      ],
      {
        child: {
          id: CHILD_ID,
          name: "Maya\u2014Rose",
          birthDate: "2020-01-02",
        },
      },
    );
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate(),
    });

    assert.equal(result.accepted, true);
    if (!result.accepted) return;
    assert.equal(result.nextMove.evidence[0]?.adultDisplayName, "Elena-Mom");
    assert.equal(
      result.nextMove.evidence[0]?.receipt,
      "From Elena-Mom’s Aug 1 check-in answer",
    );
    assert.match(result.nextMove.chatDraft, /Maya-Rose/u);
  });

  it("uses the same Unicode character limit in sanitizing and public output", () => {
    const emojiName = "🙂".repeat(50);
    const current = ledger([
      evidence("math.counts-to-5", { adultDisplayName: emojiName }),
    ]);
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate(),
    });

    assert.equal(result.accepted, true);
    if (!result.accepted) return;
    assert.equal(result.nextMove.evidence[0]?.adultDisplayName, emojiName);
  });

  it("rejects an uncited target and a forged evidence item", () => {
    const current = ledger([
      evidence("math.counts-to-5"),
      evidence("math.small-groups"),
    ]);
    const uncited = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate({ evidenceItemIds: ["math.small-groups"] }),
    });
    assert.deepEqual(
      uncited.accepted ? null : uncited.reason,
      "target_not_grounded",
    );

    const forged = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate({ evidenceItemIds: ["math.counts-to-5", "fake.item"] }),
    });
    assert.deepEqual(
      forged.accepted ? null : forged.reason,
      "unknown_evidence",
    );
  });

  it("rejects a model proposal for a different child id", () => {
    const current = ledger([evidence("math.counts-to-5")]);
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate({
        childId: "44444444-4444-4444-8444-444444444444",
      }),
    });

    assert.equal(result.accepted ? null : result.reason, "wrong_child");
  });

  it("rejects cross-subject grounding", () => {
    const current = ledger([
      evidence("math.counts-to-5"),
      evidence("phonics.single-letter-sounds"),
    ]);
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate({
        evidenceItemIds: [
          "math.counts-to-5",
          "phonics.single-letter-sounds",
        ],
      }),
    });

    assert.equal(result.accepted ? null : result.reason, "cross_subject_evidence");
  });

  it("rejects a mastered target even when its evidence is fresh", () => {
    const current = ledger([
      evidence("math.counts-to-5", { answer: "easily" }),
    ]);
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      candidate: candidate(),
    });

    assert.equal(
      result.accepted ? null : result.reason,
      "target_outside_working_edge",
    );
  });

  it("accepts direct current evidence without inventing an age ceiling", () => {
    const babyLedger = ledger(
      [evidence("phonics.single-letter-sounds")],
      {
        child: {
          id: CHILD_ID,
          name: "Maya",
          birthDate: "2025-01-02",
        },
      },
    );
    const result = verifyProgressNextMoveCandidate({
      ...state(babyLedger),
      candidate: candidate({
        targetItemId: "phonics.single-letter-sounds",
        evidenceItemIds: ["phonics.single-letter-sounds"],
      }),
    });

    assert.equal(result.accepted, true);
  });

  it("fails closed before reading a ledger from another family", () => {
    const current = ledger([evidence("math.counts-to-5")]);
    const foreign = ledger([evidence("math.counts-to-5")], {
      familyId: "44444444-4444-4444-8444-444444444444",
    });
    const result = verifyProgressNextMoveCandidate({
      ...state(current),
      ledger: foreign,
      familyId: FAMILY_ID,
      candidate: candidate(),
    });

    assert.equal(result.accepted ? null : result.reason, "wrong_child");
  });
});

describe("Progress next-move clarification journeys", () => {
  it("asks for one recent moment when there is no evidence", () => {
    const result = progressNextMoveClarification(state(ledger([])));

    assert.equal(result?.reason, "sparse");
    assert.equal(result?.sourceRevision, "7");
  });

  it("asks which family answer fits when current evidence conflicts", () => {
    const current = ledger(
      [
        evidence("math.counts-to-5", {
          id: "evidence-a",
          answer: "easily",
          idempotencyKey: "key-a",
        }),
        evidence("math.counts-to-5", {
          id: "evidence-b",
          answer: "not_yet",
          memberUserId: "44444444-4444-4444-8444-444444444444",
          adultDisplayName: "Jordan",
          idempotencyKey: "key-b",
        }),
      ],
      { conflicts: [conflict()] },
    );
    const result = progressNextMoveClarification(state(current));

    assert.equal(result?.reason, "conflict");
    assert.match(
      result?.question ?? "",
      /What does .* look like for Maya right now/u,
    );
  });

  it("checks what changed when the only known evidence is stale", () => {
    const current = ledger([
      evidence("math.counts-to-5", {
        observedAt: "2026-05-01T16:00:00.000Z",
      }),
    ]);
    const result = progressNextMoveClarification(state(current));

    assert.equal(result?.reason, "stale");
    assert.match(result?.question ?? "", /Has anything changed lately/u);
  });

  it("prioritizes fresh unknown provenance over an older stale answer", () => {
    const current = ledger([
      evidence("math.counts-to-5", {
        observedAt: "2026-05-01T16:00:00.000Z",
      }),
      evidence("math.small-groups", { derivation: "unknown" }),
    ]);
    const result = progressNextMoveClarification(state(current));

    assert.equal(result?.reason, "unknown_provenance");
    assert.match(result?.question ?? "", /small group/u);
  });
});
