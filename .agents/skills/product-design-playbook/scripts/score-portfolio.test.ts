import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  SCORE_SCHEMA_VERSION,
  ScoreValidationError,
  type FlowInventoryEntry,
  type FlowScoreSnapshot,
  type MetricOutcomeInput,
  type PortfolioScoreInput,
} from "./score-contract.ts";
import {
  assertSafeEvidencePath,
  formatAuditRunDirectoryName,
} from "./score-evidence-paths.ts";
import { classifyMetricOutcome } from "./score-outcome.ts";
import {
  calculateFlowImportance,
  scorePortfolio,
  scoreStrategy,
} from "./score-portfolio.ts";

const INVENTORY_VERSION = 1;

function createFlowInventory(): FlowInventoryEntry[] {
  return [
    {
      flowId: "native-onboarding",
      title: "Native onboarding",
      startState: "OnboardingGate",
      stopState: "First stable destination state",
      audience: "Signed-in mobile-born parent",
      channel: "native-ios",
      scopeKeys: ["mobile:onboarding"],
      critical: true,
      userValue: 3,
      frequency: 3,
      risk: 3,
      strategies: [
        { strategyId: "onboarding", role: "primary" },
        { strategyId: "activation", role: "secondary" },
      ],
      evidenceRequirements: [
        { evidenceId: "onboarding-flow", minimumLevel: "E3" },
      ],
      readinessGates: [
        { gateId: "native-accessibility", owner: "apps/mobile/AGENTS.md" },
      ],
      metricIds: ["reveal-rate"],
    },
    {
      flowId: "settings",
      title: "Settings",
      startState: "Settings root",
      stopState: "Saved setting",
      audience: "Signed-in parent",
      channel: "native-ios",
      scopeKeys: ["mobile:settings"],
      critical: false,
      userValue: 2,
      frequency: 2,
      risk: 1,
      strategies: [
        { strategyId: "trust-building", role: "primary" },
        { strategyId: "onboarding", role: "secondary" },
      ],
      evidenceRequirements: [
        { evidenceId: "settings-flow", minimumLevel: "E3" },
      ],
      readinessGates: [
        { gateId: "settings-accessibility", owner: "apps/mobile/AGENTS.md" },
      ],
      metricIds: ["settings-task-success"],
    },
  ];
}

function createSnapshot(
  flowId: string,
  maturityBasisPoints: number,
  evidenceLevel: "E0" | "E1" | "E2" | "E3" | "E4" = "E3",
): FlowScoreSnapshot {
  return {
    flowId,
    schemaVersion: SCORE_SCHEMA_VERSION,
    inventoryVersion: INVENTORY_VERSION,
    maturityBasisPoints,
    evidenceLevel,
    status: "accepted",
    stale: false,
  };
}

function createPortfolioInput(
  snapshots: FlowScoreSnapshot[],
): PortfolioScoreInput {
  return {
    schemaVersion: SCORE_SCHEMA_VERSION,
    inventoryId: "homa-family-app",
    inventoryVersion: INVENTORY_VERSION,
    acceptedBy: "founder:sidney",
    acceptedAt: "2026-08-24T15:04:05.000Z",
    decisionRef: "gh#999",
    flows: createFlowInventory(),
    snapshots,
  };
}

test("flow importance weights value and risk twice", () => {
  assert.equal(
    calculateFlowImportance({ userValue: 3, frequency: 3, risk: 3 }),
    15,
  );
  assert.equal(
    calculateFlowImportance({ userValue: 1, frequency: 1, risk: 1 }),
    5,
  );
});

test("whole-app score uses eligible snapshots and the critical-flow ceiling", () => {
  const result = scorePortfolio(
    createPortfolioInput([
      createSnapshot("native-onboarding", 6_000),
      createSnapshot("settings", 9_000, "E4"),
    ]),
  );

  assert.equal(result.status, "whole-app");
  assert.equal(result.coverageBasisPoints, 10_000);
  assert.equal(result.weightedAverageBasisPoints, 7_043);
  assert.equal(result.lowestCriticalBasisPoints, 6_000);
  assert.equal(result.appMaturityBasisPoints, 6_000);
  assert.equal(result.appMaturityDisplay, 60);
});

test("portfolio remains a preview below eighty percent coverage", () => {
  const result = scorePortfolio(
    createPortfolioInput([
      createSnapshot("native-onboarding", 6_000),
    ]),
  );

  assert.equal(result.status, "preview");
  assert.equal(result.coverageBasisPoints, 6_522);
  assert.equal(result.weightedAverageBasisPoints, 6_000);
  assert.equal(result.appMaturityBasisPoints, null);
});

test("provisional evidence does not enter portfolio calculations", () => {
  const result = scorePortfolio(
    createPortfolioInput([
      createSnapshot("native-onboarding", 9_000, "E2"),
      createSnapshot("settings", 9_000, "E4"),
    ]),
  );

  assert.equal(result.status, "preview");
  assert.equal(result.coverageBasisPoints, 3_478);
  assert.equal(result.lowestCriticalBasisPoints, null);
  assert.equal(result.appMaturityBasisPoints, null);
});

test("portfolio rejects duplicate snapshots and critical-free inventories", () => {
  const duplicateSnapshots = createPortfolioInput([
    createSnapshot("native-onboarding", 6_000),
    createSnapshot("native-onboarding", 7_000),
  ]);
  const noCritical = {
    ...createPortfolioInput([]),
    flows: createFlowInventory().map((flow) => ({
      ...flow,
      critical: false,
    })),
  };

  assert.throws(
    () => scorePortfolio(duplicateSnapshots),
    /duplicate snapshot/,
  );
  assert.throws(() => scorePortfolio(noCritical), /critical flow/);
});

test("portfolio inventory rejects self-authorization, overlap, and invalid primary mappings", () => {
  const unauthorized = {
    ...createPortfolioInput([]),
    acceptedBy: "reviewer:invented",
  };
  const overlap = createPortfolioInput([]);
  overlap.flows[1].scopeKeys = ["mobile:onboarding"];
  const missingPrimary = createPortfolioInput([]);
  missingPrimary.flows[0].strategies = [
    { strategyId: "activation", role: "secondary" },
  ];

  assert.throws(
    () => scorePortfolio(unauthorized),
    /authorized inventory approver/,
  );
  assert.throws(() => scorePortfolio(overlap), /overlapping scope key/);
  assert.throws(
    () => scorePortfolio(missingPrimary),
    /exactly one primary strategy/,
  );
});

test("portfolio rejects malformed runtime booleans and snapshot status", () => {
  const malformedCritical = createPortfolioInput([
    createSnapshot("native-onboarding", 10_000),
    createSnapshot("settings", 10_000),
  ]);
  malformedCritical.flows[0].critical = "yes" as unknown as boolean;
  const malformedStale = createPortfolioInput([
    createSnapshot("native-onboarding", 10_000),
    createSnapshot("settings", 10_000),
  ]);
  malformedStale.snapshots[0].stale = 0 as unknown as boolean;
  const malformedStatus = createPortfolioInput([
    createSnapshot("native-onboarding", 10_000),
    createSnapshot("settings", 10_000),
  ]);
  malformedStatus.snapshots[0].status =
    "invented" as FlowScoreSnapshot["status"];

  assert.throws(
    () => scorePortfolio(malformedCritical),
    /critical must be boolean/,
  );
  assert.throws(
    () => scorePortfolio(malformedStale),
    /stale must be boolean/,
  );
  assert.throws(
    () => scorePortfolio(malformedStatus),
    /snapshot status/,
  );
});

test("strategy score uses primary and secondary relevance plus coverage", () => {
  const input = createPortfolioInput([
    createSnapshot("native-onboarding", 6_000),
    createSnapshot("settings", 9_000),
  ]);

  const result = scoreStrategy("onboarding", input);

  assert.equal(result.status, "strategy");
  assert.equal(result.coverageBasisPoints, 10_000);
  assert.equal(result.scoreBasisPoints, 6_632);
  assert.equal(result.scoreDisplay, 66);
});

test("strategy remains a preview when its mapped critical flow is ineligible", () => {
  const input = createPortfolioInput([
    createSnapshot("native-onboarding", 6_000, "E2"),
    createSnapshot("settings", 9_000),
  ]);

  const result = scoreStrategy("onboarding", input);

  assert.equal(result.status, "preview");
  assert.equal(result.coverageBasisPoints, 2_105);
  assert.equal(result.scoreBasisPoints, null);
});

function createMetricInput(
  overrides: Partial<MetricOutcomeInput> = {},
): MetricOutcomeInput {
  return {
    metricId: "reveal-rate",
    role: "primary",
    authorityPath:
      "docs/homa-planning/plans/2026-08-18-mobile-onboarding-v1-plan.md",
    unit: "percentage_points",
    direction: "increase",
    baselineValue: 50,
    comparisonValue: 62,
    baselineSampleSize: 100,
    comparisonSampleSize: 100,
    minimumSampleSize: 50,
    flatTolerance: 2,
    targetValue: 70,
    targetOperator: "gte",
    missingReason: null,
    baselineWindow: {
      startedAt: "2026-08-01T00:00:00.000Z",
      endedAt: "2026-08-07T23:59:59.000Z",
    },
    comparisonWindow: {
      startedAt: "2026-08-08T00:00:00.000Z",
      endedAt: "2026-08-14T23:59:59.000Z",
    },
    instrumentationSource: "analytics:mobile-onboarding",
    ...overrides,
  };
}

test("metric outcomes are deterministic and never blended", () => {
  assert.equal(classifyMetricOutcome(createMetricInput()), "improving");
  assert.equal(
    classifyMetricOutcome(
      createMetricInput({ comparisonValue: 71 }),
    ),
    "target_met",
  );
  assert.equal(
    classifyMetricOutcome(
      createMetricInput({ comparisonValue: 49 }),
    ),
    "flat",
  );
  assert.equal(
    classifyMetricOutcome(
      createMetricInput({ comparisonValue: 40 }),
    ),
    "declining",
  );
  assert.equal(
    classifyMetricOutcome(
      createMetricInput({
        comparisonSampleSize: 10,
        missingReason: "Comparison sample is below the minimum.",
      }),
    ),
    "unknown",
  );
});

test("decreasing metrics improve when their values fall", () => {
  const result = classifyMetricOutcome(
    createMetricInput({
      metricId: "minutes-to-reveal",
      unit: "minutes",
      direction: "decrease",
      baselineValue: 8,
      comparisonValue: 5.5,
      flatTolerance: 0.25,
      targetValue: 6,
      targetOperator: "lte",
    }),
  );

  assert.equal(result, "target_met");
});

test("unknown outcomes use null measurements and an explicit reason", () => {
  const result = classifyMetricOutcome(
    createMetricInput({
      baselineValue: null,
      comparisonValue: null,
      baselineSampleSize: 0,
      comparisonSampleSize: 0,
      missingReason: "The reveal event is not implemented.",
      baselineWindow: null,
      comparisonWindow: null,
      instrumentationSource: null,
    }),
  );

  assert.equal(result, "unknown");
});

test("strict targets distinguish under from at the threshold", () => {
  const atThreshold = classifyMetricOutcome(
    createMetricInput({
      direction: "decrease",
      baselineValue: 8,
      comparisonValue: 6,
      flatTolerance: 0.25,
      targetValue: 6,
      targetOperator: "lt",
    }),
  );
  const underThreshold = classifyMetricOutcome(
    createMetricInput({
      direction: "decrease",
      baselineValue: 8,
      comparisonValue: 5.9,
      flatTolerance: 0.25,
      targetValue: 6,
      targetOperator: "lt",
    }),
  );

  assert.equal(atThreshold, "improving");
  assert.equal(underThreshold, "target_met");
});

test("known outcomes require windows, authority, and instrumentation", () => {
  assert.throws(
    () =>
      classifyMetricOutcome(
        createMetricInput({ instrumentationSource: null }),
      ),
    /instrumentation source/,
  );
  assert.throws(
    () =>
      classifyMetricOutcome(
        createMetricInput({ baselineWindow: null }),
      ),
    /baseline window/,
  );
});

test("metric contracts reject missing, negative, and incompatible fields", () => {
  const missingNumbers = createMetricInput();
  missingNumbers.comparisonSampleSize =
    undefined as unknown as number;
  missingNumbers.flatTolerance = undefined as unknown as number;
  const negativeSamples = createMetricInput({
    baselineSampleSize: -1,
  });
  const invalidDirection = createMetricInput({
    direction: "sideways" as "increase",
  });
  const invalidOperator = createMetricInput({
    targetOperator: "equals" as "gte",
  });
  const unpairedTarget = createMetricInput({
    targetValue: 70,
    targetOperator: null,
  });
  const omittedMissingReason = createMetricInput();
  omittedMissingReason.missingReason =
    undefined as unknown as null;

  assert.throws(
    () => classifyMetricOutcome(missingNumbers),
    /sample sizes and tolerance/,
  );
  assert.throws(
    () => classifyMetricOutcome(negativeSamples),
    /sample sizes/,
  );
  assert.throws(
    () => classifyMetricOutcome(invalidDirection),
    /metric direction/,
  );
  assert.throws(
    () => classifyMetricOutcome(invalidOperator),
    /target operator/,
  );
  assert.throws(
    () => classifyMetricOutcome(unpairedTarget),
    /target and operator/,
  );
  assert.throws(
    () => classifyMetricOutcome(omittedMissingReason),
    /missingReason must be string or null/,
  );
});

test("evidence paths reject escapes, absolute paths, and symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-score-"));
  const evidenceDirectory = join(root, "evidence");
  const evidenceFile = join(evidenceDirectory, "screen.png");
  const symlinkFile = join(evidenceDirectory, "linked.png");

  mkdirSync(evidenceDirectory);
  writeFileSync(evidenceFile, "synthetic evidence");
  symlinkSync(evidenceFile, symlinkFile);

  try {
    assert.equal(
      assertSafeEvidencePath(root, "evidence/screen.png"),
      realpathSync(evidenceFile),
    );
    assert.throws(
      () => assertSafeEvidencePath(root, "../outside.png"),
      ScoreValidationError,
    );
    assert.throws(
      () => assertSafeEvidencePath(root, evidenceFile),
      ScoreValidationError,
    );
    assert.throws(
      () => assertSafeEvidencePath(root, "evidence/linked.png"),
      /symlink/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("evidence paths reject restricted directories hidden by an intermediate symlink", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-path-"));
  const restrictedDirectory = join(root, ".git");
  mkdirSync(restrictedDirectory);
  writeFileSync(join(restrictedDirectory, "evidence.md"), "restricted");
  symlinkSync(restrictedDirectory, join(root, "linked"), "dir");

  try {
    assert.throws(
      () => assertSafeEvidencePath(root, "linked/evidence.md"),
      /symlink|restricted/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("audit directory names are unique, dated, and safely slugged", () => {
  const result = formatAuditRunDirectoryName(
    new Date("2026-08-24T15:04:05.000Z"),
    "Native Onboarding",
    "f33c8e3a-6e56-42d8-a427-4320c41d6017",
  );

  assert.equal(
    result,
    "2026-08-24T150405Z-native-onboarding-f33c8e3a-6e56-42d8-a427-4320c41d6017",
  );
});
