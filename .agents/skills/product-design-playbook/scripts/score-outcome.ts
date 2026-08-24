import {
  ScoreValidationError,
  assertNever,
  assertNonEmpty,
  type MetricOutcome,
  type MetricOutcomeInput,
} from "./score-contract.ts";

function targetIsMet(input: MetricOutcomeInput): boolean {
  if (
    input.comparisonValue === null ||
    input.targetValue === null ||
    input.targetOperator === null
  ) {
    return false;
  }
  switch (input.targetOperator) {
    case "gt":
      return input.comparisonValue > input.targetValue;
    case "gte":
      return input.comparisonValue >= input.targetValue;
    case "lt":
      return input.comparisonValue < input.targetValue;
    case "lte":
      return input.comparisonValue <= input.targetValue;
    default:
      return assertNever(input.targetOperator);
  }
}

function validateKnownOutcome(input: MetricOutcomeInput): void {
  if (!input.instrumentationSource?.trim()) {
    throw new ScoreValidationError(
      "known outcome requires an instrumentation source",
    );
  }
  if (!input.baselineWindow) {
    throw new ScoreValidationError(
      "known outcome requires a baseline window",
    );
  }
  if (!input.comparisonWindow) {
    throw new ScoreValidationError(
      "known outcome requires a comparison window",
    );
  }
  for (const [label, window] of [
    ["baseline", input.baselineWindow],
    ["comparison", input.comparisonWindow],
  ] as const) {
    if (
      !window.startedAt.endsWith("Z") ||
      !window.endedAt.endsWith("Z") ||
      Number.isNaN(Date.parse(window.startedAt)) ||
      Number.isNaN(Date.parse(window.endedAt)) ||
      Date.parse(window.startedAt) >= Date.parse(window.endedAt)
    ) {
      throw new ScoreValidationError(
        `${label} window must contain ordered ISO 8601 UTC timestamps`,
      );
    }
  }
}

function validateMetricContract(input: MetricOutcomeInput): void {
  assertNonEmpty(input.metricId, "metric ID");
  assertNonEmpty(input.authorityPath, "metric authority path");
  assertNonEmpty(input.unit, "metric unit");
  if (input.role !== "primary" && input.role !== "secondary") {
    throw new ScoreValidationError("metric role must be primary or secondary");
  }
  if (input.direction !== "increase" && input.direction !== "decrease") {
    throw new ScoreValidationError(
      "metric direction must be increase or decrease",
    );
  }
  if (
    input.missingReason !== null &&
    typeof input.missingReason !== "string"
  ) {
    throw new ScoreValidationError(
      "metric missingReason must be string or null",
    );
  }
  const sampleSizes = [
    input.baselineSampleSize,
    input.comparisonSampleSize,
    input.minimumSampleSize,
  ];
  if (
    sampleSizes.some(
      (sampleSize) => !Number.isInteger(sampleSize) || sampleSize < 0,
    ) ||
    input.minimumSampleSize < 1 ||
    !Number.isFinite(input.flatTolerance) ||
    input.flatTolerance < 0
  ) {
    throw new ScoreValidationError(
      "metric sample sizes and tolerance are invalid",
    );
  }
  const hasTarget = input.targetValue !== null;
  const hasOperator = input.targetOperator !== null;
  if (hasTarget !== hasOperator) {
    throw new ScoreValidationError(
      "metric target and operator must be provided together",
    );
  }
  if (
    input.targetOperator !== null &&
    !["gt", "gte", "lt", "lte"].includes(input.targetOperator)
  ) {
    throw new ScoreValidationError("unknown metric target operator");
  }
  if (
    (input.baselineValue !== null &&
      !Number.isFinite(input.baselineValue)) ||
    (input.comparisonValue !== null &&
      !Number.isFinite(input.comparisonValue)) ||
    (input.targetValue !== null && !Number.isFinite(input.targetValue))
  ) {
    throw new ScoreValidationError("metric values must be finite or null");
  }
}

export function classifyMetricOutcome(
  input: MetricOutcomeInput,
): MetricOutcome {
  validateMetricContract(input);
  if (
    input.baselineValue === null ||
    input.comparisonValue === null ||
    input.baselineSampleSize < input.minimumSampleSize ||
    input.comparisonSampleSize < input.minimumSampleSize ||
    !Number.isFinite(input.baselineValue) ||
    !Number.isFinite(input.comparisonValue)
  ) {
    if (!input.missingReason?.trim()) {
      throw new ScoreValidationError(
        "unknown outcome requires a missing reason",
      );
    }
    return "unknown";
  }
  validateKnownOutcome(input);
  if (targetIsMet(input)) {
    return "target_met";
  }
  const delta = input.comparisonValue - input.baselineValue;
  if (Math.abs(delta) <= input.flatTolerance) {
    return "flat";
  }
  switch (input.direction) {
    case "increase":
      return delta > 0 ? "improving" : "declining";
    case "decrease":
      return delta < 0 ? "improving" : "declining";
    default:
      return assertNever(input.direction);
  }
}
