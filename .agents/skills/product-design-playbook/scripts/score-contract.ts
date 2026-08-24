export const SCORE_SCHEMA_VERSION = "1.0.0";

export const STRATEGY_IDS = [
  "onboarding",
  "monetisation",
  "activation",
  "retention",
  "growth-and-viral",
  "engagement",
  "trust-building",
  "conversion-optimisation",
  "experience-refinement",
  "intent-shaping",
  "habit-formation",
  "premium-positioning",
] as const;

export const PLAY_IDS = [
  "micro-interactions",
  "empty-states",
  "success-moments",
  "loading-feedback",
  "personalisation",
  "jtbd-copywriting",
  "permission-serve",
  "intentional-friction",
  "time-to-value",
  "setup-defaults",
  "progressive-disclosure",
  "commitment",
  "deep-link",
  "contact-bridge",
  "system-widget",
  "value-replay",
  "effort-moat",
  "perceived-effort-delay",
  "momentum-bias",
  "intent-mirroring",
  "spark-curiosity",
  "sandbox-experience",
  "shareability",
  "referral",
  "variable-reward",
  "small-quirk",
  "fail-safe",
  "limited-offer",
  "discovery",
  "the-paywall",
  "investment",
  "gamified-progress",
  "pattern-alignment",
] as const;

export const EVIDENCE_LEVELS = ["E0", "E1", "E2", "E3", "E4"] as const;
export const COHERENCE_VALUES = [0, 0.25, 0.5, 0.75, 1] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];
export type PlayId = (typeof PLAY_IDS)[number];
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type Coherence = (typeof COHERENCE_VALUES)[number];
export type Applicability =
  | "not_applicable"
  | "core"
  | "supporting"
  | "polish";
export type PlayRating = 0 | 1 | 2 | 3 | 4;
export type StrategyRole = "primary" | "secondary";
export type MetricOutcome =
  | "unknown"
  | "declining"
  | "flat"
  | "improving"
  | "target_met";

export interface PlayAssessment {
  playId: PlayId;
  applicability: Applicability;
  rationale: string;
  provenanceRoutes: string[];
  rating: PlayRating | null;
  harm: boolean;
  harmExplanation: string | null;
  sourceRefs: string[];
  implementationRefs: string[];
  evidenceRefs: string[];
}

export interface FlowScoreInput {
  schemaVersion: string;
  scopeId: string;
  primaryStrategyId: StrategyId;
  selectedStrategyIds: StrategyId[];
  candidatePlayIds: PlayId[];
  plays: PlayAssessment[];
  coherence: Coherence;
  coherenceRationale: string;
}

export type FlowScoreResult =
  | {
      status: "unscorable";
      reason: "no_applicable_plays";
    }
  | {
      status: "scored";
      playExecutionNumerator: number;
      playExecutionDenominator: number;
      maturityBasisPoints: number;
      maturityDisplay: number;
    };

export interface FlowImportanceInput {
  userValue: 1 | 2 | 3;
  frequency: 1 | 2 | 3;
  risk: 1 | 2 | 3;
}

export interface FlowStrategyMapping {
  strategyId: StrategyId;
  role: StrategyRole;
}

export interface EvidenceRequirement {
  evidenceId: string;
  minimumLevel: "E2" | "E3";
}

export interface ReadinessGateRequirement {
  gateId: string;
  owner: string;
}

export interface FlowInventoryEntry extends FlowImportanceInput {
  flowId: string;
  title: string;
  startState: string;
  stopState: string;
  audience: string;
  channel: string;
  scopeKeys: string[];
  critical: boolean;
  strategies: FlowStrategyMapping[];
  evidenceRequirements: EvidenceRequirement[];
  readinessGates: ReadinessGateRequirement[];
  metricIds: string[];
}

export interface FlowScoreSnapshot {
  flowId: string;
  schemaVersion: string;
  inventoryVersion: number;
  maturityBasisPoints: number;
  evidenceLevel: EvidenceLevel;
  status: "draft" | "accepted";
  stale: boolean;
}

export interface PortfolioScoreInput {
  schemaVersion: string;
  inventoryId: string;
  inventoryVersion: number;
  acceptedBy: string;
  acceptedAt: string;
  decisionRef: string;
  flows: FlowInventoryEntry[];
  snapshots: FlowScoreSnapshot[];
}

export interface PortfolioScoreResult {
  status: "whole-app" | "preview";
  coverageBasisPoints: number;
  weightedAverageBasisPoints: number | null;
  lowestCriticalBasisPoints: number | null;
  appMaturityBasisPoints: number | null;
  appMaturityDisplay: number | null;
}

export interface StrategyScoreResult {
  status: "strategy" | "preview" | "unscorable";
  coverageBasisPoints: number;
  scoreBasisPoints: number | null;
  scoreDisplay: number | null;
}

export interface MetricOutcomeInput {
  metricId: string;
  role: "primary" | "secondary";
  authorityPath: string;
  unit: string;
  direction: "increase" | "decrease";
  baselineValue: number | null;
  comparisonValue: number | null;
  baselineSampleSize: number;
  comparisonSampleSize: number;
  minimumSampleSize: number;
  flatTolerance: number;
  targetValue: number | null;
  targetOperator: "gt" | "gte" | "lt" | "lte" | null;
  missingReason: string | null;
  baselineWindow: MetricWindow | null;
  comparisonWindow: MetricWindow | null;
  instrumentationSource: string | null;
}

export interface MetricWindow {
  startedAt: string;
  endedAt: string;
}

export class ScoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreValidationError";
  }
}

const PLAY_ID_SET = new Set<string>(PLAY_IDS);
const STRATEGY_ID_SET = new Set<string>(STRATEGY_IDS);
const COHERENCE_VALUE_SET = new Set<number>(COHERENCE_VALUES);
const APPLICABILITY_WEIGHTS: Record<
  Exclude<Applicability, "not_applicable">,
  number
> = {
  core: 3,
  supporting: 2,
  polish: 1,
};
export function assertNever(value: never): never {
  throw new ScoreValidationError(`Unhandled contract value: ${String(value)}`);
}

export function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new ScoreValidationError(`${label} must not be empty`);
  }
}

export function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new ScoreValidationError(`${label} must be unique`);
  }
}

export function roundHalfUp(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n || numerator < 0n) {
    throw new ScoreValidationError("rounding inputs must be non-negative");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return Number(remainder * 2n >= denominator ? quotient + 1n : quotient);
}

export function displayFromBasisPoints(basisPoints: number): number {
  return roundHalfUp(BigInt(basisPoints), 100n);
}

function validateCatalogIds(input: FlowScoreInput): void {
  if (input.schemaVersion !== SCORE_SCHEMA_VERSION) {
    throw new ScoreValidationError(
      `schema version must equal ${SCORE_SCHEMA_VERSION}`,
    );
  }
  assertNonEmpty(input.scopeId, "scope ID");
  assertUnique(input.selectedStrategyIds, "selected strategy IDs");
  if (input.selectedStrategyIds.length === 0) {
    throw new ScoreValidationError(
      "flow requires at least one selected strategy",
    );
  }
  if (!input.selectedStrategyIds.includes(input.primaryStrategyId)) {
    throw new ScoreValidationError(
      "primary strategy must be selected",
    );
  }
  assertUnique(input.candidatePlayIds, "candidate play IDs");

  for (const strategyId of input.selectedStrategyIds) {
    if (!STRATEGY_ID_SET.has(strategyId)) {
      throw new ScoreValidationError(`unknown strategy ID: ${strategyId}`);
    }
  }
  for (const playId of input.candidatePlayIds) {
    if (!PLAY_ID_SET.has(playId)) {
      throw new ScoreValidationError(`unknown play ID: ${playId}`);
    }
  }
}

function validateCandidateRecords(input: FlowScoreInput): void {
  const recordIds = input.plays.map((play) => play.playId);
  assertUnique(recordIds, "play records");
  const candidates = [...input.candidatePlayIds].sort();
  const records = [...recordIds].sort();

  if (
    candidates.length !== records.length ||
    candidates.some((candidate, index) => candidate !== records[index])
  ) {
    throw new ScoreValidationError(
      "candidate play records must match candidatePlayIds exactly",
    );
  }
}

function validateNotApplicablePlay(play: PlayAssessment): void {
  assertNonEmpty(play.rationale, "not-applicable rationale");
  if (play.rating !== null || play.harm || play.harmExplanation !== null) {
    throw new ScoreValidationError(
      "not-applicable play must have no rating or harm",
    );
  }
  if (play.evidenceRefs.length > 0) {
    throw new ScoreValidationError(
      "not-applicable play must have no evidence refs",
    );
  }
}

function validateApplicablePlay(play: PlayAssessment): void {
  assertNonEmpty(play.rationale, "applicable rationale");
  if (
    play.rating === null ||
    !Number.isInteger(play.rating) ||
    play.rating < 0 ||
    play.rating > 4
  ) {
    throw new ScoreValidationError("applicable play requires rating 0-4");
  }
  if (play.harm && play.rating !== 0) {
    throw new ScoreValidationError("harm requires rating 0");
  }
  if (play.harm) {
    assertNonEmpty(play.harmExplanation ?? "", "harm explanation");
  } else if (play.harmExplanation !== null) {
    throw new ScoreValidationError(
      "harm explanation requires harm to be true",
    );
  }
  if (play.sourceRefs.length === 0) {
    throw new ScoreValidationError("applicable play requires source refs");
  }
  if (play.implementationRefs.length === 0) {
    throw new ScoreValidationError(
      "applicable play requires implementation refs",
    );
  }
  if (play.evidenceRefs.length === 0) {
    throw new ScoreValidationError("applicable play requires evidence refs");
  }
}

function validatePlay(play: PlayAssessment): void {
  if (!PLAY_ID_SET.has(play.playId)) {
    throw new ScoreValidationError(`unknown play ID: ${play.playId}`);
  }
  if (play.provenanceRoutes.length === 0) {
    throw new ScoreValidationError("play requires provenance routes");
  }
  if (typeof play.harm !== "boolean") {
    throw new ScoreValidationError("play harm must be boolean");
  }
  assertUnique(play.provenanceRoutes, "play provenance routes");

  switch (play.applicability) {
    case "not_applicable":
      validateNotApplicablePlay(play);
      return;
    case "core":
    case "supporting":
    case "polish":
      validateApplicablePlay(play);
      return;
    default:
      return assertNever(play.applicability);
  }
}

function coherenceUnits(coherence: Coherence): number {
  if (!COHERENCE_VALUE_SET.has(coherence)) {
    throw new ScoreValidationError(
      "coherence must be 0, 0.25, 0.5, 0.75, or 1",
    );
  }
  return Math.round(coherence * 4);
}

function calculateFlowBasisPoints(
  executionNumerator: number,
  executionDenominator: number,
  coherence: Coherence,
): number {
  const numerator = BigInt(executionNumerator);
  const denominator = BigInt(executionDenominator);
  const coherenceQuarterUnits = BigInt(coherenceUnits(coherence));
  const weightedNumerator =
    85n * numerator * 4n +
    15n * coherenceQuarterUnits * denominator;
  const weightedDenominator = 100n * denominator * 4n;
  return roundHalfUp(10_000n * weightedNumerator, weightedDenominator);
}

export function scoreFlow(input: FlowScoreInput): FlowScoreResult {
  validateCatalogIds(input);
  validateCandidateRecords(input);
  assertNonEmpty(input.coherenceRationale, "coherence rationale");
  coherenceUnits(input.coherence);
  input.plays.forEach(validatePlay);

  let executionNumerator = 0;
  let executionDenominator = 0;
  for (const play of input.plays) {
    if (play.applicability === "not_applicable") {
      continue;
    }
    const weight = APPLICABILITY_WEIGHTS[play.applicability];
    executionNumerator += weight * (play.rating ?? 0);
    executionDenominator += weight * 4;
  }

  if (executionDenominator === 0) {
    return { status: "unscorable", reason: "no_applicable_plays" };
  }

  const maturityBasisPoints = calculateFlowBasisPoints(
    executionNumerator,
    executionDenominator,
    input.coherence,
  );
  return {
    status: "scored",
    playExecutionNumerator: executionNumerator,
    playExecutionDenominator: executionDenominator,
    maturityBasisPoints,
    maturityDisplay: displayFromBasisPoints(maturityBasisPoints),
  };
}
