import {
  EVIDENCE_LEVELS,
  SCORE_SCHEMA_VERSION,
  STRATEGY_IDS,
  ScoreValidationError,
  assertNever,
  assertNonEmpty,
  assertUnique,
  displayFromBasisPoints,
  roundHalfUp,
  type FlowImportanceInput,
  type FlowScoreSnapshot,
  type PortfolioScoreInput,
  type PortfolioScoreResult,
  type StrategyId,
  type StrategyRole,
  type StrategyScoreResult,
} from "./score-contract.ts";

const AUTHORIZED_INVENTORY_APPROVER_IDS = new Set(["founder:sidney"]);
const EVIDENCE_LEVEL_SET = new Set<string>(EVIDENCE_LEVELS);
const STRATEGY_ID_SET = new Set<string>(STRATEGY_IDS);

function assertImportanceValue(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 3) {
    throw new ScoreValidationError(`${label} must be 1, 2, or 3`);
  }
}

export function calculateFlowImportance(input: FlowImportanceInput): number {
  assertImportanceValue(input.userValue, "user value");
  assertImportanceValue(input.frequency, "frequency");
  assertImportanceValue(input.risk, "risk");
  return 2 * input.userValue + input.frequency + 2 * input.risk;
}

function isEligibleSnapshot(snapshot: FlowScoreSnapshot): boolean {
  return (
    snapshot.status === "accepted" &&
    !snapshot.stale &&
    (snapshot.evidenceLevel === "E3" || snapshot.evidenceLevel === "E4")
  );
}

function validateFlowManifests(
  flow: PortfolioScoreInput["flows"][number],
): void {
  assertUnique(
    flow.evidenceRequirements.map(
      (requirement) => requirement.evidenceId,
    ),
    "flow evidence requirements",
  );
  assertUnique(
    flow.readinessGates.map((gate) => gate.gateId),
    "flow readiness gates",
  );
  assertUnique(flow.metricIds, "flow metric IDs");
  if (
    flow.evidenceRequirements.length === 0 ||
    flow.readinessGates.length === 0 ||
    flow.metricIds.length === 0
  ) {
    throw new ScoreValidationError(
      "flow evidence, readiness, and metric manifests must not be empty",
    );
  }
  for (const requirement of flow.evidenceRequirements) {
    assertNonEmpty(requirement.evidenceId, "evidence requirement ID");
    if (
      requirement.minimumLevel !== "E2" &&
      requirement.minimumLevel !== "E3"
    ) {
      throw new ScoreValidationError(
        "evidence requirement level must be E2 or E3",
      );
    }
  }
  for (const gate of flow.readinessGates) {
    assertNonEmpty(gate.gateId, "readiness gate ID");
    assertNonEmpty(gate.owner, "readiness gate owner");
  }
  for (const metricId of flow.metricIds) {
    assertNonEmpty(metricId, "flow metric ID");
  }
}

function validateFlowStrategies(
  flow: PortfolioScoreInput["flows"][number],
): void {
  assertUnique(
    flow.strategies.map((mapping) => mapping.strategyId),
    "flow strategy mappings",
  );
  const primaryMappings = flow.strategies.filter(
    (mapping) => mapping.role === "primary",
  );
  if (primaryMappings.length !== 1) {
    throw new ScoreValidationError(
      "flow requires exactly one primary strategy",
    );
  }
  for (const mapping of flow.strategies) {
    if (!STRATEGY_ID_SET.has(mapping.strategyId)) {
      throw new ScoreValidationError(
        `unknown strategy ID: ${mapping.strategyId}`,
      );
    }
    if (mapping.role !== "primary" && mapping.role !== "secondary") {
      throw new ScoreValidationError(
        `unknown strategy role: ${String(mapping.role)}`,
      );
    }
  }
}

function validateFlowInventory(input: PortfolioScoreInput): void {
  const claimedScopeKeys = new Set<string>();
  for (const flow of input.flows) {
    if (typeof flow.critical !== "boolean") {
      throw new ScoreValidationError("flow critical must be boolean");
    }
    if (!Array.isArray(flow.scopeKeys) || !Array.isArray(flow.strategies)) {
      throw new ScoreValidationError(
        "flow scope keys and strategies must be arrays",
      );
    }
    if (
      !Array.isArray(flow.evidenceRequirements) ||
      !Array.isArray(flow.readinessGates) ||
      !Array.isArray(flow.metricIds)
    ) {
      throw new ScoreValidationError("flow manifests must be arrays");
    }
    assertNonEmpty(flow.flowId, "flow ID");
    assertNonEmpty(flow.title, "flow title");
    assertNonEmpty(flow.startState, "flow start state");
    assertNonEmpty(flow.stopState, "flow stop state");
    assertNonEmpty(flow.audience, "flow audience");
    assertNonEmpty(flow.channel, "flow channel");
    calculateFlowImportance(flow);
    assertUnique(flow.scopeKeys, "flow scope keys");
    if (flow.scopeKeys.length === 0) {
      throw new ScoreValidationError("flow requires scope keys");
    }
    for (const scopeKey of flow.scopeKeys) {
      assertNonEmpty(scopeKey, "scope key");
      if (claimedScopeKeys.has(scopeKey)) {
        throw new ScoreValidationError(
          `inventory has overlapping scope key: ${scopeKey}`,
        );
      }
      claimedScopeKeys.add(scopeKey);
    }
    validateFlowStrategies(flow);
    validateFlowManifests(flow);
  }
}

function validateSnapshots(input: PortfolioScoreInput): void {
  const flowIds = new Set(input.flows.map((flow) => flow.flowId));
  for (const snapshot of input.snapshots) {
    if (typeof snapshot.stale !== "boolean") {
      throw new ScoreValidationError("snapshot stale must be boolean");
    }
    if (snapshot.status !== "draft" && snapshot.status !== "accepted") {
      throw new ScoreValidationError("unknown snapshot status");
    }
    if (!flowIds.has(snapshot.flowId)) {
      throw new ScoreValidationError(
        `snapshot has unknown flow: ${snapshot.flowId}`,
      );
    }
    if (
      snapshot.schemaVersion !== input.schemaVersion ||
      snapshot.inventoryVersion !== input.inventoryVersion
    ) {
      throw new ScoreValidationError("snapshot versions are incompatible");
    }
    if (
      !Number.isInteger(snapshot.maturityBasisPoints) ||
      snapshot.maturityBasisPoints < 0 ||
      snapshot.maturityBasisPoints > 10_000
    ) {
      throw new ScoreValidationError(
        "snapshot maturity must be 0-10000 basis points",
      );
    }
    if (!EVIDENCE_LEVEL_SET.has(snapshot.evidenceLevel)) {
      throw new ScoreValidationError("unknown evidence level");
    }
  }
}

function validatePortfolio(input: PortfolioScoreInput): void {
  if (input.schemaVersion !== SCORE_SCHEMA_VERSION) {
    throw new ScoreValidationError(
      `schema version must equal ${SCORE_SCHEMA_VERSION}`,
    );
  }
  if (!Number.isInteger(input.inventoryVersion) || input.inventoryVersion < 1) {
    throw new ScoreValidationError("inventory version must be positive");
  }
  assertNonEmpty(input.inventoryId, "inventory ID");
  if (!AUTHORIZED_INVENTORY_APPROVER_IDS.has(input.acceptedBy)) {
    throw new ScoreValidationError(
      "portfolio requires an authorized inventory approver",
    );
  }
  if (
    !input.acceptedAt.endsWith("Z") ||
    Number.isNaN(Date.parse(input.acceptedAt))
  ) {
    throw new ScoreValidationError(
      "inventory acceptance timestamp must be ISO 8601 UTC",
    );
  }
  assertNonEmpty(input.decisionRef, "inventory decision reference");
  if (input.flows.length === 0) {
    throw new ScoreValidationError("portfolio requires flow inventory");
  }
  assertUnique(
    input.flows.map((flow) => flow.flowId),
    "flow inventory IDs",
  );
  assertUnique(
    input.snapshots.map((snapshot) => snapshot.flowId),
    "duplicate snapshot flow IDs",
  );
  if (!input.flows.some((flow) => flow.critical)) {
    throw new ScoreValidationError("portfolio requires a critical flow");
  }
  validateFlowInventory(input);
  validateSnapshots(input);
}

function snapshotMap(
  input: PortfolioScoreInput,
): Map<string, FlowScoreSnapshot> {
  return new Map(
    input.snapshots.map((snapshot) => [snapshot.flowId, snapshot]),
  );
}

export function scorePortfolio(
  input: PortfolioScoreInput,
): PortfolioScoreResult {
  validatePortfolio(input);
  const snapshots = snapshotMap(input);
  let totalImportance = 0;
  let eligibleImportance = 0;
  let weightedMaturity = 0;
  const eligibleCritical: number[] = [];

  for (const flow of input.flows) {
    const importance = calculateFlowImportance(flow);
    const snapshot = snapshots.get(flow.flowId);
    totalImportance += importance;
    if (!snapshot || !isEligibleSnapshot(snapshot)) {
      continue;
    }
    eligibleImportance += importance;
    weightedMaturity += importance * snapshot.maturityBasisPoints;
    if (flow.critical) {
      eligibleCritical.push(snapshot.maturityBasisPoints);
    }
  }

  const coverageBasisPoints = roundHalfUp(
    10_000n * BigInt(eligibleImportance),
    BigInt(totalImportance),
  );
  const weightedAverageBasisPoints =
    eligibleImportance === 0
      ? null
      : roundHalfUp(
          BigInt(weightedMaturity),
          BigInt(eligibleImportance),
        );
  const criticalCount = input.flows.filter((flow) => flow.critical).length;
  const allCriticalEligible = eligibleCritical.length === criticalCount;
  const lowestCriticalBasisPoints = allCriticalEligible
    ? Math.min(...eligibleCritical)
    : null;
  const canPublish =
    coverageBasisPoints >= 8_000 &&
    allCriticalEligible &&
    weightedAverageBasisPoints !== null &&
    lowestCriticalBasisPoints !== null;
  const appMaturityBasisPoints = canPublish
    ? Math.min(weightedAverageBasisPoints, lowestCriticalBasisPoints)
    : null;

  return {
    status: canPublish ? "whole-app" : "preview",
    coverageBasisPoints,
    weightedAverageBasisPoints,
    lowestCriticalBasisPoints,
    appMaturityBasisPoints,
    appMaturityDisplay:
      appMaturityBasisPoints === null
        ? null
        : displayFromBasisPoints(appMaturityBasisPoints),
  };
}

function relevanceWeight(role: StrategyRole): number {
  switch (role) {
    case "primary":
      return 2;
    case "secondary":
      return 1;
    default:
      return assertNever(role);
  }
}

export function scoreStrategy(
  strategyId: StrategyId,
  input: PortfolioScoreInput,
): StrategyScoreResult {
  validatePortfolio(input);
  if (!STRATEGY_ID_SET.has(strategyId)) {
    throw new ScoreValidationError(`unknown strategy ID: ${strategyId}`);
  }
  const snapshots = snapshotMap(input);
  let totalWeight = 0;
  let eligibleWeight = 0;
  let weightedMaturity = 0;
  let mappedCritical = 0;
  let eligibleCritical = 0;

  for (const flow of input.flows) {
    const mapping = flow.strategies.find(
      (candidate) => candidate.strategyId === strategyId,
    );
    if (!mapping) {
      continue;
    }
    const weight =
      calculateFlowImportance(flow) * relevanceWeight(mapping.role);
    const snapshot = snapshots.get(flow.flowId);
    totalWeight += weight;
    if (flow.critical) {
      mappedCritical += 1;
    }
    if (!snapshot || !isEligibleSnapshot(snapshot)) {
      continue;
    }
    eligibleWeight += weight;
    weightedMaturity += weight * snapshot.maturityBasisPoints;
    if (flow.critical) {
      eligibleCritical += 1;
    }
  }

  if (totalWeight === 0) {
    return {
      status: "unscorable",
      coverageBasisPoints: 0,
      scoreBasisPoints: null,
      scoreDisplay: null,
    };
  }
  const coverageBasisPoints = roundHalfUp(
    10_000n * BigInt(eligibleWeight),
    BigInt(totalWeight),
  );
  const canPublish =
    coverageBasisPoints >= 8_000 && eligibleCritical === mappedCritical;
  const scoreBasisPoints =
    canPublish && eligibleWeight > 0
      ? roundHalfUp(
          BigInt(weightedMaturity),
          BigInt(eligibleWeight),
        )
      : null;
  return {
    status: canPublish ? "strategy" : "preview",
    coverageBasisPoints,
    scoreBasisPoints,
    scoreDisplay:
      scoreBasisPoints === null
        ? null
        : displayFromBasisPoints(scoreBasisPoints),
  };
}
