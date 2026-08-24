import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAY_IDS,
  SCORE_SCHEMA_VERSION,
  STRATEGY_IDS,
  ScoreValidationError,
  scoreFlow,
  type FlowScoreInput,
  type PlayAssessment,
} from "./score-contract.ts";

function createApplicablePlay(
  playId: PlayAssessment["playId"],
  applicability: "core" | "supporting" | "polish",
  rating: 0 | 1 | 2 | 3 | 4,
  overrides: Partial<PlayAssessment> = {},
): PlayAssessment {
  return {
    playId,
    applicability,
    rationale: `${playId} applies to the tested flow.`,
    provenanceRoutes: ["strategy:onboarding"],
    rating,
    harm: false,
    harmExplanation: null,
    sourceRefs: [`docs/product-design-playbook/plays/${playId}.md`],
    implementationRefs: ["apps/mobile/src/app/(onboarding)/hello.tsx"],
    evidenceRefs: [
      "owned:apps/mobile/src/app/(onboarding)/hello.tsx",
    ],
    ...overrides,
  };
}

function createNotApplicablePlay(
  playId: PlayAssessment["playId"],
): PlayAssessment {
  return {
    playId,
    applicability: "not_applicable",
    rationale: `${playId} does not belong in this flow.`,
    provenanceRoutes: ["strategy:onboarding"],
    rating: null,
    harm: false,
    harmExplanation: null,
    sourceRefs: [`docs/product-design-playbook/plays/${playId}.md`],
    implementationRefs: [],
    evidenceRefs: [],
  };
}

function createFlowInput(
  plays: PlayAssessment[],
  coherence: FlowScoreInput["coherence"] = 1,
): FlowScoreInput {
  return {
    schemaVersion: SCORE_SCHEMA_VERSION,
    scopeId: "native-onboarding",
    primaryStrategyId: "onboarding",
    selectedStrategyIds: ["onboarding"],
    candidatePlayIds: plays.map((play) => play.playId),
    plays,
    coherence,
    coherenceRationale: "The journey has one clear first-value arc.",
  };
}

test("catalog exposes the exact twelve strategies and thirty-three plays", () => {
  assert.equal(STRATEGY_IDS.length, 12);
  assert.equal(PLAY_IDS.length, 33);
  assert.ok(STRATEGY_IDS.includes("onboarding"));
  assert.ok(STRATEGY_IDS.includes("premium-positioning"));
  assert.ok(PLAY_IDS.includes("time-to-value"));
  assert.ok(PLAY_IDS.includes("pattern-alignment"));
  assert.equal(new Set(STRATEGY_IDS).size, STRATEGY_IDS.length);
  assert.equal(new Set(PLAY_IDS).size, PLAY_IDS.length);
});

test("perfect applicable play execution and coherence score 10000 basis points", () => {
  const input = createFlowInput([
    createApplicablePlay("time-to-value", "core", 4),
    createApplicablePlay("loading-feedback", "supporting", 4),
  ]);

  const result = scoreFlow(input);

  assert.equal(result.status, "scored");
  assert.equal(result.playExecutionNumerator, 20);
  assert.equal(result.playExecutionDenominator, 20);
  assert.equal(result.maturityBasisPoints, 10_000);
  assert.equal(result.maturityDisplay, 100);
});

test("flow score uses dynamic leverage and coherence without intermediate rounding", () => {
  const input = createFlowInput(
    [
      createApplicablePlay("time-to-value", "core", 2),
      createApplicablePlay("loading-feedback", "supporting", 4),
    ],
    0.5,
  );

  const result = scoreFlow(input);

  assert.equal(result.status, "scored");
  assert.equal(result.playExecutionNumerator, 14);
  assert.equal(result.playExecutionDenominator, 20);
  assert.equal(result.maturityBasisPoints, 6_700);
  assert.equal(result.maturityDisplay, 67);
});

test("not-applicable plays leave the score denominator", () => {
  const input = createFlowInput([
    createApplicablePlay("time-to-value", "core", 4),
    createNotApplicablePlay("contact-bridge"),
  ]);

  const result = scoreFlow(input);

  assert.equal(result.status, "scored");
  assert.equal(result.playExecutionDenominator, 12);
  assert.equal(result.maturityBasisPoints, 10_000);
});

test("an empty applicable set is unscorable instead of zero", () => {
  const input = createFlowInput([
    createNotApplicablePlay("contact-bridge"),
    createNotApplicablePlay("system-widget"),
  ]);

  const result = scoreFlow(input);

  assert.deepEqual(result, {
    status: "unscorable",
    reason: "no_applicable_plays",
  });
});

test("every candidate requires exactly one play record", () => {
  const play = createApplicablePlay("time-to-value", "core", 4);
  const missingRecord = {
    ...createFlowInput([play]),
    candidatePlayIds: ["time-to-value", "loading-feedback"],
  } satisfies FlowScoreInput;

  assert.throws(
    () => scoreFlow(missingRecord),
    (error: unknown) =>
      error instanceof ScoreValidationError &&
      error.message.includes("candidate play records"),
  );
});

test("a scored play cannot sit outside the candidate universe", () => {
  const input = {
    ...createFlowInput([
      createApplicablePlay("time-to-value", "core", 4),
      createApplicablePlay("loading-feedback", "supporting", 3),
    ]),
    candidatePlayIds: ["time-to-value"],
  } satisfies FlowScoreInput;

  assert.throws(
    () => scoreFlow(input),
    (error: unknown) =>
      error instanceof ScoreValidationError &&
      error.message.includes("candidate play records"),
  );
});

test("harm is valid only with rating zero and an explanation", () => {
  const invalidRating = createApplicablePlay(
    "time-to-value",
    "core",
    1,
    {
      harm: true,
      harmExplanation: "The flow delays first value.",
    },
  );
  const missingExplanation = createApplicablePlay(
    "time-to-value",
    "core",
    0,
    {
      harm: true,
      harmExplanation: null,
    },
  );

  assert.throws(
    () => scoreFlow(createFlowInput([invalidRating])),
    /harm requires rating 0/,
  );
  assert.throws(
    () => scoreFlow(createFlowInput([missingExplanation])),
    /harm explanation/,
  );
});

test("applicable ratings require evidence references", () => {
  const play = createApplicablePlay("time-to-value", "core", 4, {
    evidenceRefs: [],
  });

  assert.throws(
    () => scoreFlow(createFlowInput([play])),
    /evidence refs/,
  );
});

test("applicable ratings require an implementation or insertion reference", () => {
  const play = createApplicablePlay("time-to-value", "core", 4, {
    implementationRefs: [],
  });

  assert.throws(
    () => scoreFlow(createFlowInput([play])),
    /implementation refs/,
  );
});

test("not-applicable records require a reason and no rating", () => {
  const invalid = {
    ...createNotApplicablePlay("contact-bridge"),
    rationale: "",
    rating: 2,
  } as PlayAssessment;

  assert.throws(
    () => scoreFlow(createFlowInput([invalid])),
    /not-applicable/,
  );
});

test("coherence accepts only the closed quarter-step scale", () => {
  const input = {
    ...createFlowInput([
      createApplicablePlay("time-to-value", "core", 4),
    ]),
    coherence: 0.6,
  } as unknown as FlowScoreInput;

  assert.throws(() => scoreFlow(input), /coherence/);
});

test("schema versions must match exactly", () => {
  const input = {
    ...createFlowInput([
      createApplicablePlay("time-to-value", "core", 4),
    ]),
    schemaVersion: "1.0.1",
  };

  assert.throws(() => scoreFlow(input), /schema version/);
});

test("primary strategy must be selected", () => {
  const input = {
    ...createFlowInput([
      createApplicablePlay("time-to-value", "core", 4),
    ]),
    primaryStrategyId: "retention",
  } satisfies FlowScoreInput;

  assert.throws(() => scoreFlow(input), /primary strategy/);
});
