import { validateCandidateProvenance } from "./catalog-registry.ts";
import {
  ScoreValidationError,
  scoreFlow,
  type FlowScoreInput,
  type FlowScoreResult,
} from "./score-contract.ts";

export interface FlowEstimateInput {
  current: FlowScoreInput;
  proposed: FlowScoreInput;
  rationale: string;
  affectedFiles: string[];
  verificationEvidenceRefs: string[];
}

export type FlowEstimateResult =
  | {
      status: "unscorable";
      current: FlowScoreResult;
      proposed: FlowScoreResult;
      deltaBasisPoints: null;
      deltaDisplay: null;
    }
  | {
      status: "estimated";
      current: Extract<FlowScoreResult, { status: "scored" }>;
      proposed: Extract<FlowScoreResult, { status: "scored" }>;
      deltaBasisPoints: number;
      deltaDisplay: number;
    };

export function scoreFlowEstimate(
  input: FlowEstimateInput,
): FlowEstimateResult {
  if (input.current.scopeId !== input.proposed.scopeId) {
    throw new ScoreValidationError(
      "estimate requires current and proposed judgments for the same scope",
    );
  }
  const sameSet = (
    left: readonly string[],
    right: readonly string[],
  ): boolean =>
    left.length === right.length &&
    [...left].sort().every(
      (value, index) => value === [...right].sort()[index],
    );
  if (
    input.current.primaryStrategyId !== input.proposed.primaryStrategyId ||
    !sameSet(
      input.current.selectedStrategyIds,
      input.proposed.selectedStrategyIds,
    )
  ) {
    throw new ScoreValidationError(
      "estimate requires the same strategy contract",
    );
  }
  if (
    !sameSet(
      input.current.candidatePlayIds,
      input.proposed.candidatePlayIds,
    )
  ) {
    throw new ScoreValidationError(
      "estimate requires the same candidate universe",
    );
  }
  if (!input.rationale.trim()) {
    throw new ScoreValidationError("estimate requires rationale");
  }
  if (input.affectedFiles.length === 0) {
    throw new ScoreValidationError("estimate requires affected files");
  }
  if (input.affectedFiles.some((path) => !path.trim())) {
    throw new ScoreValidationError(
      "estimate affected file entries must not be empty",
    );
  }
  if (input.verificationEvidenceRefs.length === 0) {
    throw new ScoreValidationError(
      "estimate requires verification evidence refs",
    );
  }
  if (
    input.verificationEvidenceRefs.some(
      (evidenceRef) => !evidenceRef.trim(),
    )
  ) {
    throw new ScoreValidationError(
      "estimate verification evidence ref entries must not be empty",
    );
  }
  validateCandidateProvenance(
    input.current.selectedStrategyIds,
    input.current.plays,
  );
  validateCandidateProvenance(
    input.proposed.selectedStrategyIds,
    input.proposed.plays,
  );
  const current = scoreFlow(input.current);
  const proposed = scoreFlow(input.proposed);
  if (current.status !== "scored" || proposed.status !== "scored") {
    return {
      status: "unscorable",
      current,
      proposed,
      deltaBasisPoints: null,
      deltaDisplay: null,
    };
  }
  const deltaBasisPoints =
    proposed.maturityBasisPoints - current.maturityBasisPoints;
  const deltaDisplay =
    deltaBasisPoints >= 0
      ? Math.floor((deltaBasisPoints + 50) / 100)
      : Math.ceil((deltaBasisPoints - 50) / 100);
  return {
    status: "estimated",
    current,
    proposed,
    deltaBasisPoints,
    deltaDisplay,
  };
}
