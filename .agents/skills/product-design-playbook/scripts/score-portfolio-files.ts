import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scoreFlowAudit, type FlowAuditInput } from "./audit-contract.ts";
import { assertCommittedAuditAuthority } from "./score-artifact-authority.ts";
import {
  ScoreValidationError,
  type FlowScoreSnapshot,
  type PortfolioScoreInput,
  type PortfolioScoreResult,
  type StrategyId,
  type StrategyScoreResult,
} from "./score-contract.ts";
import { assertSafeEvidencePath } from "./score-evidence-paths.ts";
import {
  scorePortfolio,
  scoreStrategy,
} from "./score-portfolio.ts";

export interface AuditFileReference {
  path: string;
  sha256: string;
}

export type AcceptedPortfolioInventory = Omit<
  PortfolioScoreInput,
  "snapshots"
>;

export interface PortfolioFileInput {
  inventoryFile: AuditFileReference;
  auditFiles: AuditFileReference[];
}

function hashFile(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function assertExpectedHash(path: string, expectedHash: string): void {
  if (!/^[0-9a-f]{64}$/i.test(expectedHash)) {
    throw new ScoreValidationError("audit file hash must be SHA-256");
  }
  if (hashFile(path) !== expectedHash.toLowerCase()) {
    throw new ScoreValidationError(
      `audit file hash does not match: ${path}`,
    );
  }
}

export function loadVerifiedAuditFile(
  file: AuditFileReference,
  repositoryRoot: string,
  allowUncommittedArtifacts = false,
): FlowAuditInput {
  const path = assertSafeEvidencePath(repositoryRoot, file.path);
  assertExpectedHash(path, file.sha256);
  if (!allowUncommittedArtifacts) {
    assertCommittedAuditAuthority(
      repositoryRoot,
      file.path,
      file.sha256,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as FlowAuditInput;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function deriveSnapshot(
  audit: FlowAuditInput,
  inventory: AcceptedPortfolioInventory,
  repositoryRoot: string,
): FlowScoreSnapshot {
  const inventoryFlow = inventory.flows.find(
    (flow) => flow.flowId === audit.scope.flowId,
  );
  if (!inventoryFlow) {
    throw new ScoreValidationError(
      `audit flow is absent from inventory: ${audit.scope.flowId}`,
    );
  }
  if (
    audit.schemaVersion !== inventory.schemaVersion ||
    audit.inventoryVersion !== inventory.inventoryVersion
  ) {
    throw new ScoreValidationError(
      "audit and portfolio versions are incompatible",
    );
  }
  if (!sameSet(audit.scope.scopeKeys, inventoryFlow.scopeKeys)) {
    throw new ScoreValidationError(
      "audit scope keys do not match accepted inventory",
    );
  }
  if (
    audit.scope.title !== inventoryFlow.title ||
    audit.scope.startState !== inventoryFlow.startState ||
    audit.scope.stopState !== inventoryFlow.stopState ||
    audit.scope.audience !== inventoryFlow.audience ||
    audit.scope.channel !== inventoryFlow.channel
  ) {
    throw new ScoreValidationError(
      "audit boundary, audience, or channel does not match inventory",
    );
  }
  const inventoryStrategies = inventoryFlow.strategies.map(
    (mapping) => mapping.strategyId,
  );
  if (
    !sameSet(audit.score.selectedStrategyIds, inventoryStrategies) ||
    audit.score.primaryStrategyId !==
      inventoryFlow.strategies.find((mapping) => mapping.role === "primary")
        ?.strategyId
  ) {
    throw new ScoreValidationError(
      "audit strategies do not match accepted inventory",
    );
  }
  const inventoryEvidenceIds = inventoryFlow.evidenceRequirements.map(
    (requirement) => requirement.evidenceId,
  );
  if (!sameSet(audit.evidence.requiredIds, inventoryEvidenceIds)) {
    throw new ScoreValidationError(
      "audit evidence manifest does not match inventory",
    );
  }
  const inventoryGateIds = inventoryFlow.readinessGates.map(
    (gate) => gate.gateId,
  );
  if (!sameSet(audit.readiness.requiredGateIds, inventoryGateIds)) {
    throw new ScoreValidationError(
      "audit readiness manifest does not match inventory",
    );
  }
  for (const result of audit.readiness.results) {
    const inventoryGate = inventoryFlow.readinessGates.find(
      (gate) => gate.gateId === result.gateId,
    );
    if (inventoryGate && inventoryGate.owner !== result.owner) {
      throw new ScoreValidationError(
        `readiness gate owner does not match inventory: ${result.gateId}`,
      );
    }
  }
  if (
    !sameSet(
      audit.outcomes.map((outcome) => outcome.metricId),
      inventoryFlow.metricIds,
    )
  ) {
    throw new ScoreValidationError(
      "audit metric manifest does not match inventory",
    );
  }
  const result = scoreFlowAudit(audit, repositoryRoot);
  const eligibleEvidence =
    result.evidenceLevel === "E3" || result.evidenceLevel === "E4";
  if (
    audit.status !== "accepted" ||
    !eligibleEvidence ||
    result.score.status !== "scored"
  ) {
    throw new ScoreValidationError(
      `audit is not portfolio eligible: ${audit.scope.flowId}`,
    );
  }
  return {
    flowId: audit.scope.flowId,
    schemaVersion: audit.schemaVersion,
    inventoryVersion: audit.inventoryVersion,
    maturityBasisPoints: result.score.maturityBasisPoints,
    evidenceLevel: result.evidenceLevel,
    status: "accepted",
    stale: false,
  };
}

export function loadVerifiedPortfolioInput(
  input: PortfolioFileInput,
  repositoryRoot: string,
  allowUncommittedArtifacts = false,
): PortfolioScoreInput {
  const inventoryPath = assertSafeEvidencePath(
    repositoryRoot,
    input.inventoryFile.path,
  );
  assertExpectedHash(inventoryPath, input.inventoryFile.sha256);
  if (!allowUncommittedArtifacts) {
    assertCommittedAuditAuthority(
      repositoryRoot,
      input.inventoryFile.path,
      input.inventoryFile.sha256,
    );
  }
  const inventory = JSON.parse(
    readFileSync(inventoryPath, "utf8"),
  ) as AcceptedPortfolioInventory;
  if ("snapshots" in inventory) {
    throw new ScoreValidationError(
      "accepted inventory file cannot contain score snapshots",
    );
  }
  scorePortfolio({ ...inventory, snapshots: [] });
  const snapshots = input.auditFiles.map((file) => {
    const parsed = loadVerifiedAuditFile(
      file,
      repositoryRoot,
      allowUncommittedArtifacts,
    );
    return deriveSnapshot(parsed, inventory, repositoryRoot);
  });
  return {
    ...inventory,
    snapshots,
  };
}

export function scorePortfolioFiles(
  input: PortfolioFileInput,
  repositoryRoot: string,
  allowUncommittedArtifacts = false,
): PortfolioScoreResult {
  return scorePortfolio(
    loadVerifiedPortfolioInput(
      input,
      repositoryRoot,
      allowUncommittedArtifacts,
    ),
  );
}

export function scoreStrategyFiles(
  strategyId: StrategyId,
  input: PortfolioFileInput,
  repositoryRoot: string,
  allowUncommittedArtifacts = false,
): StrategyScoreResult {
  return scoreStrategy(
    strategyId,
    loadVerifiedPortfolioInput(
      input,
      repositoryRoot,
      allowUncommittedArtifacts,
    ),
  );
}
