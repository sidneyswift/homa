import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateCandidateProvenance } from "./catalog-registry.ts";
import {
  EVIDENCE_LEVELS,
  SCORE_SCHEMA_VERSION,
  ScoreValidationError,
  scoreFlow,
  type EvidenceLevel,
  type FlowScoreInput,
  type FlowScoreResult,
  type MetricOutcome,
  type MetricOutcomeInput,
} from "./score-contract.ts";
import {
  assertSafeEvidencePath,
  assertSafeRepositoryFilePath,
} from "./score-evidence-paths.ts";
import { classifyMetricOutcome } from "./score-outcome.ts";

export type AuditStatus = "draft" | "accepted";
export type ReadinessStatus = "not_checked" | "ready" | "blocked";

export interface AuditAcceptance {
  acceptedBy: string;
  acceptedAt: string;
  decisionRef: string;
}

export interface AuditScope {
  flowId: string;
  title: string;
  startState: string;
  stopState: string;
  audience: string;
  channel: string;
  scopeKeys: string[];
}

export interface EvidenceArtifact {
  evidenceId: string;
  path: string;
  sha256: string;
  environment: string;
  device: string;
  operatingSystem: string;
  state: string;
  capturedAt: string;
}

export interface AuditEvidence {
  level: EvidenceLevel;
  requiredIds: string[];
  satisfiedIds: string[];
  artifacts: EvidenceArtifact[];
  e4Evidence: E4Evidence | null;
}

export interface E4Evidence {
  sourceType: "user_research" | "production_metric";
  population: string;
  sampleSize: number;
  collectionStartedAt: string;
  collectionEndedAt: string;
  consentBasis: string;
  acceptedBy: string;
  acceptedAt: string;
  artifactRefs: string[];
}

export interface ReadinessGateResult {
  gateId: string;
  owner: string;
  status: "pass" | "fail";
  evidenceRefs: string[];
}

export interface AuditReadiness {
  status: ReadinessStatus;
  requiredGateIds: string[];
  results: ReadinessGateResult[];
}

export interface AuditDataSafety {
  classification: "synthetic" | "designated_demo";
  fixtureId: string;
  realFamilyData: boolean;
  redactionReviewer: string;
  reviewedAt: string;
}

export interface OwnedFile {
  path: string;
  sha256: string;
}

export interface FlowAuditInput {
  schemaVersion: string;
  inventoryVersion: number;
  runId: string;
  auditedAt: string;
  repositoryCommit: string;
  status: AuditStatus;
  acceptance: AuditAcceptance | null;
  authorizedApproverIds: string[];
  scope: AuditScope;
  score: FlowScoreInput;
  evidence: AuditEvidence;
  readiness: AuditReadiness;
  dataSafety: AuditDataSafety;
  outcomes: MetricOutcomeInput[];
  ownedFiles: OwnedFile[];
}

export interface FlowAuditResult {
  score: FlowScoreResult;
  evidenceLevel: EvidenceLevel;
  outcomes: {
    metricId: string;
    state: MetricOutcome;
  }[];
  readiness: ReadinessStatus;
  portfolioEligible: boolean;
}

const EVIDENCE_LEVEL_SET = new Set<string>(EVIDENCE_LEVELS);
const AUTHORIZED_AUDIT_APPROVER_IDS = new Set(["founder:sidney"]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const ISO_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new ScoreValidationError(`${label} must not be empty`);
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new ScoreValidationError(`${label} must be unique`);
  }
}

function assertIsoDate(value: string, label: string): void {
  if (
    typeof value !== "string" ||
    !ISO_UTC_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new ScoreValidationError(`${label} must be ISO 8601 UTC`);
  }
}

function assertHash(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new ScoreValidationError(`${label} must be SHA-256`);
  }
}

function validateIdentity(input: FlowAuditInput): void {
  if (input.schemaVersion !== SCORE_SCHEMA_VERSION) {
    throw new ScoreValidationError(
      `schema version must equal ${SCORE_SCHEMA_VERSION}`,
    );
  }
  if (!Number.isInteger(input.inventoryVersion) || input.inventoryVersion < 1) {
    throw new ScoreValidationError("inventory version must be positive");
  }
  if (!UUID_PATTERN.test(input.runId)) {
    throw new ScoreValidationError("run ID must be a UUID");
  }
  if (!COMMIT_PATTERN.test(input.repositoryCommit)) {
    throw new ScoreValidationError(
      "repository commit must be a full Git SHA",
    );
  }
  if (input.status !== "draft" && input.status !== "accepted") {
    throw new ScoreValidationError("unknown audit status");
  }
  assertIsoDate(input.auditedAt, "audit timestamp");
}

function validateAcceptance(input: FlowAuditInput): void {
  assertUnique(input.authorizedApproverIds, "authorized approver IDs");
  if (
    input.authorizedApproverIds.some(
      (approverId) => !AUTHORIZED_AUDIT_APPROVER_IDS.has(approverId),
    )
  ) {
    throw new ScoreValidationError(
      "audit contains an unauthorized approver ID",
    );
  }
  if (input.status === "draft") {
    if (input.acceptance !== null) {
      throw new ScoreValidationError(
        "draft audit cannot include acceptance",
      );
    }
    return;
  }
  if (!input.acceptance) {
    throw new ScoreValidationError(
      "accepted audit requires acceptance",
    );
  }
  if (
    !AUTHORIZED_AUDIT_APPROVER_IDS.has(input.acceptance.acceptedBy)
  ) {
    throw new ScoreValidationError(
      "accepted audit requires an authorized approver",
    );
  }
  assertIsoDate(input.acceptance.acceptedAt, "acceptance timestamp");
  assertNonEmpty(input.acceptance.decisionRef, "acceptance decision reference");
}

function validateScope(input: FlowAuditInput): void {
  const fields = [
    ["flow ID", input.scope.flowId],
    ["scope title", input.scope.title],
    ["start state", input.scope.startState],
    ["stop state", input.scope.stopState],
    ["audience", input.scope.audience],
    ["channel", input.scope.channel],
  ] as const;
  for (const [label, value] of fields) {
    assertNonEmpty(value, label);
  }
  if (!Array.isArray(input.scope.scopeKeys)) {
    throw new ScoreValidationError("scope keys must be an array");
  }
  assertUnique(input.scope.scopeKeys, "scope keys");
  if (input.scope.scopeKeys.length === 0) {
    throw new ScoreValidationError("scope requires at least one scope key");
  }
  if (input.score.scopeId !== input.scope.flowId) {
    throw new ScoreValidationError(
      "score scope ID must match audit flow ID",
    );
  }
}

function validateEvidence(evidence: AuditEvidence): void {
  if (!EVIDENCE_LEVEL_SET.has(evidence.level)) {
    throw new ScoreValidationError("unknown evidence level");
  }
  if (
    !Array.isArray(evidence.requiredIds) ||
    !Array.isArray(evidence.satisfiedIds) ||
    !Array.isArray(evidence.artifacts)
  ) {
    throw new ScoreValidationError(
      "evidence IDs and artifacts must be arrays",
    );
  }
  assertUnique(evidence.requiredIds, "required evidence IDs");
  assertUnique(evidence.satisfiedIds, "satisfied evidence IDs");
  const required = new Set(evidence.requiredIds);
  const satisfied = new Set(evidence.satisfiedIds);
  const requiresCompleteManifest =
    evidence.level === "E2" ||
    evidence.level === "E3" ||
    evidence.level === "E4";
  if (requiresCompleteManifest && evidence.requiredIds.length === 0) {
    throw new ScoreValidationError(
      "evidence manifest cannot be empty for E2-E4",
    );
  }
  if (
    requiresCompleteManifest &&
    [...required].some((evidenceId) => !satisfied.has(evidenceId))
  ) {
    throw new ScoreValidationError(
      "evidence manifest is incomplete for selected level",
    );
  }
  const artifactEvidenceIds = new Set(
    evidence.artifacts.map((artifact) => artifact.evidenceId),
  );
  if (
    requiresCompleteManifest &&
    evidence.requiredIds.some(
      (evidenceId) => !artifactEvidenceIds.has(evidenceId),
    )
  ) {
    throw new ScoreValidationError(
      "evidence manifest requires a hashed artifact for every item",
    );
  }
  for (const artifact of evidence.artifacts) {
    assertNonEmpty(artifact.evidenceId, "artifact evidence ID");
    assertNonEmpty(artifact.path, "artifact path");
    assertHash(artifact.sha256, "artifact hash");
    assertIsoDate(artifact.capturedAt, "artifact timestamp");
    assertNonEmpty(artifact.environment, "artifact environment");
    assertNonEmpty(artifact.device, "artifact device");
    assertNonEmpty(artifact.operatingSystem, "artifact operating system");
    assertNonEmpty(artifact.state, "artifact state");
  }
  if (evidence.level === "E4") {
    const e4 = evidence.e4Evidence;
    if (!e4) {
      throw new ScoreValidationError(
        "E4 evidence requires accepted research or production evidence",
      );
    }
    assertNonEmpty(e4.population, "E4 population");
    assertNonEmpty(e4.consentBasis, "E4 consent basis");
    assertNonEmpty(e4.acceptedBy, "E4 reviewer");
    if (
      e4.sourceType !== "user_research" &&
      e4.sourceType !== "production_metric"
    ) {
      throw new ScoreValidationError("unknown E4 source type");
    }
    assertIsoDate(e4.collectionStartedAt, "E4 collection start");
    assertIsoDate(e4.collectionEndedAt, "E4 collection end");
    assertIsoDate(e4.acceptedAt, "E4 acceptance timestamp");
    if (
      Date.parse(e4.collectionStartedAt) >=
      Date.parse(e4.collectionEndedAt)
    ) {
      throw new ScoreValidationError(
        "E4 collection window must be ordered",
      );
    }
    if (!AUTHORIZED_AUDIT_APPROVER_IDS.has(e4.acceptedBy)) {
      throw new ScoreValidationError(
        "E4 evidence requires an authorized reviewer",
      );
    }
    assertUnique(e4.artifactRefs, "E4 artifact refs");
    if (
      e4.artifactRefs.length === 0 ||
      e4.artifactRefs.some(
        (artifactRef) => !artifactEvidenceIds.has(artifactRef),
      )
    ) {
      throw new ScoreValidationError(
        "E4 artifact ref must resolve to hashed audit evidence",
      );
    }
    if (!Number.isInteger(e4.sampleSize) || e4.sampleSize < 1) {
      throw new ScoreValidationError(
        "E4 evidence requires a positive sample size",
      );
    }
  } else if (evidence.e4Evidence !== null) {
    throw new ScoreValidationError(
      "E4 evidence metadata requires evidence level E4",
    );
  }
}

function validateReadiness(readiness: AuditReadiness): void {
  if (
    readiness.status !== "not_checked" &&
    readiness.status !== "ready" &&
    readiness.status !== "blocked"
  ) {
    throw new ScoreValidationError("unknown readiness status");
  }
  assertUnique(readiness.requiredGateIds, "required readiness gate IDs");
  assertUnique(
    readiness.results.map((result) => result.gateId),
    "readiness gate results",
  );
  const results = new Map(
    readiness.results.map((result) => [result.gateId, result]),
  );
  for (const result of readiness.results) {
    assertNonEmpty(result.owner, "readiness gate owner");
    if (result.status !== "pass" && result.status !== "fail") {
      throw new ScoreValidationError(
        "readiness result status must be pass or fail",
      );
    }
    if (result.evidenceRefs.length === 0) {
      throw new ScoreValidationError(
        "readiness evidence references must not be empty",
      );
    }
  }
  if (readiness.status === "ready") {
    if (readiness.requiredGateIds.length === 0) {
      throw new ScoreValidationError(
        "ready audit requires at least one readiness gate",
      );
    }
    const everyGatePasses = readiness.requiredGateIds.every(
      (gateId) => results.get(gateId)?.status === "pass",
    );
    if (!everyGatePasses) {
      throw new ScoreValidationError(
        "ready audit requires a passing readiness gate result for every gate",
      );
    }
  }
  if (
    readiness.status === "blocked" &&
    !readiness.results.some((result) => result.status === "fail")
  ) {
    throw new ScoreValidationError(
      "blocked audit requires a failed readiness gate result",
    );
  }
}

function validateDataSafety(dataSafety: AuditDataSafety): void {
  if (
    dataSafety.classification !== "synthetic" &&
    dataSafety.classification !== "designated_demo"
  ) {
    throw new ScoreValidationError("unknown audit data classification");
  }
  if (dataSafety.realFamilyData !== false) {
    throw new ScoreValidationError(
      "audit realFamilyData must be false; real family data is prohibited",
    );
  }
  assertNonEmpty(dataSafety.fixtureId, "fixture ID");
  assertNonEmpty(dataSafety.redactionReviewer, "redaction reviewer");
  assertIsoDate(dataSafety.reviewedAt, "redaction review timestamp");
}

function validateOwnedFiles(ownedFiles: OwnedFile[]): void {
  assertUnique(
    ownedFiles.map((file) => file.path),
    "owned file paths",
  );
  for (const file of ownedFiles) {
    assertNonEmpty(file.path, "owned file path");
    assertHash(file.sha256, "owned file hash");
  }
}

function validateRatingEvidence(input: FlowAuditInput): void {
  const ownedPaths = new Set(input.ownedFiles.map((file) => file.path));
  const artifactIds = new Set(
    input.evidence.artifacts.map((artifact) => artifact.evidenceId),
  );
  const validateEvidenceRef = (evidenceRef: string): void => {
    if (evidenceRef.startsWith("owned:")) {
      const ownedPath = evidenceRef.slice("owned:".length);
      if (!ownedPaths.has(ownedPath)) {
        throw new ScoreValidationError(
          `owned file manifest is missing evidence ref: ${ownedPath}`,
        );
      }
      return;
    }
    if (evidenceRef.startsWith("artifact:")) {
      const artifactId = evidenceRef.slice("artifact:".length);
      if (!artifactIds.has(artifactId)) {
        throw new ScoreValidationError(
          `evidence artifact is missing: ${artifactId}`,
        );
      }
      return;
    }
    throw new ScoreValidationError(
      `evidence ref must use owned: or artifact:: ${evidenceRef}`,
    );
  };
  for (const play of input.score.plays) {
    if (play.applicability === "not_applicable") {
      continue;
    }
    for (const implementationPath of play.implementationRefs) {
      if (!ownedPaths.has(implementationPath)) {
        throw new ScoreValidationError(
          `owned file manifest is missing implementation ref: ${implementationPath}`,
        );
      }
    }
    for (const evidenceRef of play.evidenceRefs) {
      validateEvidenceRef(evidenceRef);
    }
  }
  for (const result of input.readiness.results) {
    result.evidenceRefs.forEach(validateEvidenceRef);
  }
}

function assertCurrentHash(path: string, expectedHash: string): void {
  const actualHash = createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
  if (actualHash !== expectedHash.toLowerCase()) {
    throw new ScoreValidationError(`hash does not match current file: ${path}`);
  }
}

function validateCurrentFiles(
  input: FlowAuditInput,
  repositoryRoot: string,
): void {
  for (const artifact of input.evidence.artifacts) {
    const path = assertSafeEvidencePath(repositoryRoot, artifact.path);
    assertCurrentHash(path, artifact.sha256);
  }
  for (const file of input.ownedFiles) {
    const path = assertSafeRepositoryFilePath(repositoryRoot, file.path);
    assertCurrentHash(path, file.sha256);
  }
}

export function scoreFlowAudit(
  input: FlowAuditInput,
  repositoryRoot = process.cwd(),
): FlowAuditResult {
  validateIdentity(input);
  validateAcceptance(input);
  validateScope(input);
  validateEvidence(input.evidence);
  validateReadiness(input.readiness);
  validateDataSafety(input.dataSafety);
  validateOwnedFiles(input.ownedFiles);
  validateRatingEvidence(input);
  validateCurrentFiles(input, repositoryRoot);
  validateCandidateProvenance(
    input.score.selectedStrategyIds,
    input.score.plays,
  );
  const e4Evidence = input.evidence.e4Evidence;
  if (
    e4Evidence &&
    Date.parse(e4Evidence.collectionEndedAt) > Date.parse(input.auditedAt)
  ) {
    throw new ScoreValidationError(
      "E4 collection cannot end after the audit timestamp",
    );
  }
  if (
    input.status === "accepted" &&
    (input.evidence.level === "E3" || input.evidence.level === "E4") &&
    input.outcomes.length === 0
  ) {
    throw new ScoreValidationError(
      "accepted E3 or E4 audit requires an outcome manifest",
    );
  }
  const score = scoreFlow(input.score);
  const outcomes = input.outcomes.map((outcome) => ({
    metricId: outcome.metricId,
    state: classifyMetricOutcome(outcome),
  }));
  if (
    e4Evidence?.sourceType === "production_metric" &&
    outcomes.every((outcome) => outcome.state === "unknown")
  ) {
    throw new ScoreValidationError(
      "production-metric E4 requires at least one known outcome",
    );
  }
  return {
    score,
    evidenceLevel: input.evidence.level,
    outcomes,
    readiness: input.readiness.status,
    portfolioEligible: false,
  };
}
