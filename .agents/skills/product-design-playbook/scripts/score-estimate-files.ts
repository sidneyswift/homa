import { scoreFlowAudit } from "./audit-contract.ts";
import {
  scoreFlowEstimate,
  type FlowEstimateResult,
} from "./score-estimate.ts";
import {
  loadVerifiedAuditFile,
  type AuditFileReference,
} from "./score-portfolio-files.ts";
import {
  ScoreValidationError,
  type FlowScoreInput,
} from "./score-contract.ts";

export interface EstimateFileInput {
  baselineAuditFile: AuditFileReference;
  proposed: FlowScoreInput;
  rationale: string;
  affectedFiles: string[];
  verificationEvidenceRefs: string[];
}

export function scoreEstimateFile(
  input: EstimateFileInput,
  repositoryRoot: string,
  allowUncommittedArtifacts = false,
): FlowEstimateResult {
  const baseline = loadVerifiedAuditFile(
    input.baselineAuditFile,
    repositoryRoot,
    allowUncommittedArtifacts,
  );
  const baselineResult = scoreFlowAudit(baseline, repositoryRoot);
  const eligibleEvidence =
    baselineResult.evidenceLevel === "E3" ||
    baselineResult.evidenceLevel === "E4";
  if (
    baseline.status !== "accepted" ||
    !eligibleEvidence ||
    baselineResult.score.status !== "scored"
  ) {
    throw new ScoreValidationError(
      "estimate requires an accepted E3 or E4 baseline audit",
    );
  }
  return scoreFlowEstimate({
    current: baseline.score,
    proposed: input.proposed,
    rationale: input.rationale,
    affectedFiles: input.affectedFiles,
    verificationEvidenceRefs: input.verificationEvidenceRefs,
  });
}
