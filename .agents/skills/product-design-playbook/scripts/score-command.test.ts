import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  PLAY_SOURCE_PATHS,
  deriveCandidatePlayIds,
} from "./catalog-registry.ts";
import {
  SCORE_SCHEMA_VERSION,
  ScoreValidationError,
} from "./score-contract.ts";
import {
  parseScoreCommandDocument,
  scoreProductDesignDocument,
  type FlowAuditInput,
  type ScoreCommandDocument,
} from "./score-product-design.mts";
import type { PortfolioFileInput } from "./score-portfolio-files.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

function hashFile(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function hashRepositoryFile(path: string): string {
  return hashFile(resolve(repositoryRoot, path));
}

function createFlowDocument(): ScoreCommandDocument {
  return {
    mode: "flow",
    input: {
      schemaVersion: SCORE_SCHEMA_VERSION,
      scopeId: "native-onboarding",
      primaryStrategyId: "onboarding",
      selectedStrategyIds: ["onboarding"],
      candidatePlayIds: ["time-to-value"],
      plays: [
        {
          playId: "time-to-value",
          applicability: "core",
          rationale: "First value is the flow's core promise.",
          provenanceRoutes: ["strategy:onboarding"],
          rating: 4,
          harm: false,
          harmExplanation: null,
          sourceRefs: [
            "docs/product-design-playbook/plays/09-time-to-value.md",
          ],
          implementationRefs: [
            "apps/mobile/src/app/(onboarding)/reveal.tsx",
          ],
          evidenceRefs: [
            "owned:apps/mobile/src/app/(onboarding)/reveal.tsx",
          ],
        },
      ],
      coherence: 1,
      coherenceRationale: "The flow reaches one clear artifact.",
    },
  };
}

function createAuditInput(
  overrides: Partial<FlowAuditInput> = {},
): FlowAuditInput {
  const candidatePlayIds = deriveCandidatePlayIds(["activation"]);
  const score: FlowAuditInput["score"] = {
    schemaVersion: SCORE_SCHEMA_VERSION,
    scopeId: "native-onboarding",
    primaryStrategyId: "activation",
    selectedStrategyIds: ["activation"],
    candidatePlayIds,
    plays: candidatePlayIds.map((playId) => ({
      playId,
      applicability:
        playId === "time-to-value" ? "core" : "not_applicable",
      rationale:
        playId === "time-to-value"
          ? "First value is the flow's core promise."
          : `${playId} is outside this narrow test fixture.`,
      provenanceRoutes: ["strategy:activation"],
      rating: playId === "time-to-value" ? 4 : null,
      harm: false,
      harmExplanation: null,
      sourceRefs: [PLAY_SOURCE_PATHS[playId]],
      implementationRefs:
        playId === "time-to-value"
          ? ["package.json"]
          : [],
      evidenceRefs:
        playId === "time-to-value" ? ["owned:package.json"] : [],
    })),
    coherence: 1,
    coherenceRationale: "The flow reaches one clear artifact.",
  };
  return {
    schemaVersion: SCORE_SCHEMA_VERSION,
    inventoryVersion: 1,
    runId: "f33c8e3a-6e56-42d8-a427-4320c41d6017",
    auditedAt: "2026-08-24T15:04:05.000Z",
    repositoryCommit: "6c0bc4b1356afca2ce60aff75bd3ad33408826d3",
    status: "draft",
    acceptance: null,
    authorizedApproverIds: ["founder:sidney"],
    scope: {
      flowId: "native-onboarding",
      title: "Native onboarding",
      startState: "OnboardingGate",
      stopState: "First stable destination state",
      audience: "Signed-in mobile-born parent",
      channel: "native-ios",
      scopeKeys: ["mobile:onboarding"],
    },
    score,
    evidence: {
      level: "E1",
      requiredIds: [],
      satisfiedIds: [],
      artifacts: [],
      e4Evidence: null,
    },
    readiness: {
      status: "not_checked",
      requiredGateIds: ["native-accessibility"],
      results: [],
    },
    dataSafety: {
      classification: "designated_demo",
      fixtureId: "app-review-family",
      realFamilyData: false,
      redactionReviewer: "agent",
      reviewedAt: "2026-08-24T15:04:05.000Z",
    },
    outcomes: [],
    ownedFiles: [
      {
        path: "package.json",
        sha256: hashRepositoryFile("package.json"),
      },
    ],
    ...overrides,
  };
}

function createAcceptedAuditFile(root: string): FlowAuditInput {
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "evidence"), { recursive: true });
  writeFileSync(join(root, "src", "flow.ts"), "export const flow = true;");
  writeFileSync(join(root, "evidence", "screen.png"), "rendered");
  const audit = createAuditInput({
    status: "accepted",
    acceptance: {
      acceptedBy: "founder:sidney",
      acceptedAt: "2026-08-24T16:00:00.000Z",
      decisionRef: "gh#999",
    },
    evidence: {
      level: "E3",
      requiredIds: ["screen"],
      satisfiedIds: ["screen"],
      artifacts: [
        {
          evidenceId: "screen",
          path: "evidence/screen.png",
          sha256: hashFile(join(root, "evidence", "screen.png")),
          environment: "test",
          device: "simulator",
          operatingSystem: "iOS",
          state: "reveal",
          capturedAt: "2026-08-24T15:04:05.000Z",
        },
      ],
      e4Evidence: null,
    },
    readiness: {
      status: "blocked",
      requiredGateIds: ["native-accessibility"],
      results: [
        {
          gateId: "native-accessibility",
          owner: "apps/mobile/src/lib/accessibility/acceptance-manifest.ts",
          status: "fail",
          evidenceRefs: ["artifact:screen"],
        },
      ],
    },
    outcomes: [
      {
        metricId: "reveal-rate",
        role: "primary",
        authorityPath: "docs/homa-planning/mobile-onboarding.md",
        unit: "percentage_points",
        direction: "increase",
        baselineValue: null,
        comparisonValue: null,
        baselineSampleSize: 0,
        comparisonSampleSize: 0,
        minimumSampleSize: 1,
        flatTolerance: 1,
        targetValue: null,
        targetOperator: null,
        missingReason: "No production event exists.",
        baselineWindow: null,
        comparisonWindow: null,
        instrumentationSource: null,
      },
    ],
    ownedFiles: [
      {
        path: "src/flow.ts",
        sha256: hashFile(join(root, "src", "flow.ts")),
      },
    ],
  });
  const applicablePlay = audit.score.plays.find(
    (play) => play.applicability !== "not_applicable",
  );
  assert.ok(applicablePlay);
  applicablePlay.implementationRefs = ["src/flow.ts"];
  applicablePlay.evidenceRefs = ["owned:src/flow.ts", "artifact:screen"];
  writeFileSync(join(root, "baseline-audit.json"), JSON.stringify(audit));
  return audit;
}

test("flow command documents return deterministic score output", () => {
  const result = scoreProductDesignDocument(createFlowDocument());

  assert.equal(result.mode, "flow");
  assert.equal(result.result.status, "scored");
  if (result.result.status === "scored") {
    assert.equal(result.result.maturityBasisPoints, 10_000);
  }
});

test("portfolio command documents calculate the critical-flow ceiling", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-portfolio-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "evidence"));
  writeFileSync(join(root, "src", "flow.ts"), "export const flow = true;");
  writeFileSync(join(root, "evidence", "screen.png"), "rendered");
  const audit = createAuditInput({
    status: "accepted",
    acceptance: {
      acceptedBy: "founder:sidney",
      acceptedAt: "2026-08-24T16:00:00.000Z",
      decisionRef: "gh#999",
    },
    evidence: {
      level: "E3",
      requiredIds: ["screen"],
      satisfiedIds: ["screen"],
      artifacts: [
        {
          evidenceId: "screen",
          path: "evidence/screen.png",
          sha256: hashFile(join(root, "evidence", "screen.png")),
          environment: "test",
          device: "simulator",
          operatingSystem: "iOS",
          state: "reveal",
          capturedAt: "2026-08-24T15:04:05.000Z",
        },
      ],
      e4Evidence: null,
    },
    readiness: {
      status: "blocked",
      requiredGateIds: ["native-accessibility"],
      results: [
        {
          gateId: "native-accessibility",
          owner: "apps/mobile/src/lib/accessibility/acceptance-manifest.ts",
          status: "fail",
          evidenceRefs: ["artifact:screen"],
        },
      ],
    },
    ownedFiles: [
      {
        path: "src/flow.ts",
        sha256: hashFile(join(root, "src", "flow.ts")),
      },
    ],
  });
  const applicablePlay = audit.score.plays.find(
    (play) => play.applicability !== "not_applicable",
  );
  assert.ok(applicablePlay);
  applicablePlay.implementationRefs = ["src/flow.ts"];
  applicablePlay.evidenceRefs = ["owned:src/flow.ts", "artifact:screen"];
  writeFileSync(join(root, "audit.json"), JSON.stringify(audit));
  audit.outcomes = [
    {
      metricId: "reveal-rate",
      role: "primary",
      authorityPath: "docs/homa-planning/mobile-onboarding.md",
      unit: "percentage_points",
      direction: "increase",
      baselineValue: null,
      comparisonValue: null,
      baselineSampleSize: 0,
      comparisonSampleSize: 0,
      minimumSampleSize: 1,
      flatTolerance: 1,
      targetValue: null,
      targetOperator: null,
      missingReason: "No production event exists.",
      baselineWindow: null,
      comparisonWindow: null,
      instrumentationSource: null,
    },
  ];
  writeFileSync(join(root, "audit.json"), JSON.stringify(audit));
  const inventory = {
    schemaVersion: SCORE_SCHEMA_VERSION,
    inventoryId: "homa-family-app",
    inventoryVersion: 1,
    acceptedBy: "founder:sidney",
    acceptedAt: "2026-08-24T15:04:05.000Z",
    decisionRef: "gh#999",
    flows: [
      {
        flowId: "native-onboarding",
        title: "Native onboarding",
        startState: "OnboardingGate",
        stopState: "First stable destination state",
        audience: "Signed-in mobile-born parent",
        channel: "native-ios",
        scopeKeys: ["mobile:onboarding"],
        critical: true,
        userValue: 3 as const,
        frequency: 3 as const,
        risk: 3 as const,
        strategies: [
          { strategyId: "activation" as const, role: "primary" as const },
        ],
        evidenceRequirements: [
          { evidenceId: "screen", minimumLevel: "E3" as const },
        ],
        readinessGates: [
          {
            gateId: "native-accessibility",
            owner: "apps/mobile/src/lib/accessibility/acceptance-manifest.ts",
          },
        ],
        metricIds: ["reveal-rate"],
      },
    ],
  };
  writeFileSync(join(root, "inventory.json"), JSON.stringify(inventory));
  const portfolioInput: PortfolioFileInput = {
    inventoryFile: {
      path: "inventory.json",
      sha256: hashFile(join(root, "inventory.json")),
    },
    auditFiles: [
      {
        path: "audit.json",
        sha256: hashFile(join(root, "audit.json")),
      },
    ],
  };
  const document = {
    mode: "portfolio",
    input: portfolioInput,
  } as unknown as ScoreCommandDocument;

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(document, {
          repositoryRoot: root,
        }),
      /committed audit authority/,
    );
    const result = scoreProductDesignDocument(document, {
      repositoryRoot: root,
      allowUncommittedArtifacts: true,
    });
    assert.equal(result.mode, "portfolio");
    assert.equal(result.result.status, "whole-app");
    assert.equal(result.result.appMaturityBasisPoints, 10_000);

    const mismatchedInventory = structuredClone(inventory);
    mismatchedInventory.flows[0].evidenceRequirements = [
      { evidenceId: "different", minimumLevel: "E3" },
    ];
    writeFileSync(
      join(root, "mismatched-inventory.json"),
      JSON.stringify(mismatchedInventory),
    );
    const mismatchedDocument = {
      mode: "portfolio",
      input: {
        ...portfolioInput,
        inventoryFile: {
          path: "mismatched-inventory.json",
          sha256: hashFile(join(root, "mismatched-inventory.json")),
        },
      },
    } as unknown as ScoreCommandDocument;
    assert.throws(
      () =>
        scoreProductDesignDocument(mismatchedDocument, {
          repositoryRoot: root,
          allowUncommittedArtifacts: true,
        }),
      /evidence manifest does not match inventory/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("estimate command compares compatible flow judgments without claiming impact", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-estimate-"));
  const baseline = createAcceptedAuditFile(root);
  const currentPlay = baseline.score.plays.find(
    (play) => play.playId === "time-to-value",
  );
  assert.ok(currentPlay);
  currentPlay.rating = 2;
  writeFileSync(
    join(root, "baseline-audit.json"),
    JSON.stringify(baseline),
  );
  const proposed = structuredClone(baseline.score);
  const proposedPlay = proposed.plays.find(
    (play) => play.playId === "time-to-value",
  );
  assert.ok(proposedPlay);
  proposedPlay.rating = 4;

  try {
    const result = scoreProductDesignDocument(
      {
        mode: "estimate",
        input: {
          baselineAuditFile: {
            path: "baseline-audit.json",
            sha256: hashFile(join(root, "baseline-audit.json")),
          },
          proposed,
          rationale: "Shorten the path to first value.",
          affectedFiles: ["src/flow.ts"],
          verificationEvidenceRefs: ["artifact:screen"],
        },
      } as unknown as ScoreCommandDocument,
      {
        repositoryRoot: root,
        allowUncommittedArtifacts: true,
      },
    );

    assert.equal(result.mode, "estimate");
    assert.equal(result.result.status, "estimated");
    assert.ok(result.result.deltaBasisPoints > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("estimate command rejects different flow boundaries", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-estimate-"));
  const baseline = createAcceptedAuditFile(root);
  const proposed = structuredClone(baseline.score);
  proposed.scopeId = "different-flow";

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(
          {
            mode: "estimate",
            input: {
              baselineAuditFile: {
                path: "baseline-audit.json",
                sha256: hashFile(join(root, "baseline-audit.json")),
              },
              proposed,
              rationale: "Invalid scope comparison.",
              affectedFiles: ["src/flow.ts"],
              verificationEvidenceRefs: ["artifact:screen"],
            },
          } as unknown as ScoreCommandDocument,
          {
            repositoryRoot: root,
            allowUncommittedArtifacts: true,
          },
        ),
      /same scope/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("estimate command preserves strategy and candidate contracts", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-estimate-"));
  const baseline = createAcceptedAuditFile(root);
  const proposed = structuredClone(baseline.score);
  proposed.candidatePlayIds = proposed.candidatePlayIds.slice(1);
  proposed.plays = proposed.plays.slice(1);

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(
          {
            mode: "estimate",
            input: {
              baselineAuditFile: {
                path: "baseline-audit.json",
                sha256: hashFile(join(root, "baseline-audit.json")),
              },
              proposed,
              rationale: "Invalid candidate change.",
              affectedFiles: ["src/flow.ts"],
              verificationEvidenceRefs: ["artifact:screen"],
            },
          } as unknown as ScoreCommandDocument,
          {
            repositoryRoot: root,
            allowUncommittedArtifacts: true,
          },
        ),
      /same candidate universe/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("estimate command rejects empty metadata entries", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-estimate-"));
  const baseline = createAcceptedAuditFile(root);
  const proposed = structuredClone(baseline.score);
  const baselineAuditFile = {
    path: "baseline-audit.json",
    sha256: hashFile(join(root, "baseline-audit.json")),
  };

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(
          {
            mode: "estimate",
            input: {
              baselineAuditFile,
              proposed,
              rationale: "A real rationale.",
              affectedFiles: [""],
              verificationEvidenceRefs: ["artifact:screen"],
            },
          } as unknown as ScoreCommandDocument,
          {
            repositoryRoot: root,
            allowUncommittedArtifacts: true,
          },
        ),
      /affected file/,
    );
    assert.throws(
      () =>
        scoreProductDesignDocument(
          {
            mode: "estimate",
            input: {
              baselineAuditFile,
              proposed,
              rationale: "A real rationale.",
              affectedFiles: ["src/flow.ts"],
              verificationEvidenceRefs: [""],
            },
          } as unknown as ScoreCommandDocument,
          {
            repositoryRoot: root,
            allowUncommittedArtifacts: true,
          },
        ),
      /verification evidence ref/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown command modes fail closed", () => {
  const document = {
    mode: "invented",
    input: {},
  } as unknown as ScoreCommandDocument;

  assert.throws(
    () => scoreProductDesignDocument(document),
    /unknown scoring mode/,
  );
});

test("runtime command parsing rejects malformed nested documents", () => {
  assert.throws(
    () =>
      parseScoreCommandDocument({
        mode: "audit",
        input: null,
      }),
    /audit input/,
  );
  assert.throws(
    () =>
      parseScoreCommandDocument({
        mode: "invented",
        input: {},
      }),
    /unknown scoring mode/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument(
        parseScoreCommandDocument({
          mode: "flow",
          input: {},
        }),
      ),
    (error: unknown) =>
      error instanceof ScoreValidationError,
  );
});

test("audit documents keep maturity, evidence, outcomes, and readiness separate", () => {
  const document: ScoreCommandDocument = {
    mode: "audit",
    input: createAuditInput(),
  };

  const result = scoreProductDesignDocument(document);

  assert.equal(result.mode, "audit");
  assert.equal(result.result.score.status, "scored");
  assert.equal(result.result.evidenceLevel, "E1");
  assert.deepEqual(result.result.outcomes, []);
  assert.equal(result.result.readiness, "not_checked");
  assert.equal(result.result.portfolioEligible, false);
});

test("E3 audits require every evidence manifest item", () => {
  const audit = createAuditInput({
    evidence: {
      level: "E3",
      requiredIds: ["reveal-rendered", "print-handoff"],
      satisfiedIds: ["reveal-rendered"],
      artifacts: [],
      e4Evidence: null,
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /evidence manifest/,
  );
});

test("accepted audits require an authorized approver", () => {
  const audit = createAuditInput({
    status: "accepted",
    acceptance: {
      acceptedBy: "reviewer:unknown",
      acceptedAt: "2026-08-24T16:00:00.000Z",
      decisionRef: "gh#999",
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /authorized approver/,
  );
});

test("audits cannot self-authorize a new approver", () => {
  const audit = createAuditInput({
    status: "accepted",
    authorizedApproverIds: ["reviewer:invented"],
    acceptance: {
      acceptedBy: "reviewer:invented",
      acceptedAt: "2026-08-24T16:00:00.000Z",
      decisionRef: "gh#999",
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /authorized approver/,
  );
});

test("ready audits require passing results for every gate", () => {
  const audit = createAuditInput({
    readiness: {
      status: "ready",
      requiredGateIds: ["native-accessibility"],
      results: [],
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /readiness gate/,
  );
});

test("readiness results require evidence references", () => {
  const audit = createAuditInput({
    readiness: {
      status: "blocked",
      requiredGateIds: ["native-accessibility"],
      results: [
        {
          gateId: "native-accessibility",
          owner: "apps/mobile/src/lib/accessibility/acceptance-manifest.ts",
          status: "fail",
          evidenceRefs: [],
        },
      ],
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /readiness evidence/,
  );
});

test("E3 and ready labels cannot self-certify empty manifests", () => {
  const audit = createAuditInput({
    evidence: {
      level: "E3",
      requiredIds: [],
      satisfiedIds: [],
      artifacts: [],
      e4Evidence: null,
    },
    readiness: {
      status: "ready",
      requiredGateIds: [],
      results: [],
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /evidence manifest/,
  );
});

test("audit data safety fails closed on real family data", () => {
  const audit = createAuditInput({
    dataSafety: {
      classification: "designated_demo",
      fixtureId: "app-review-family",
      realFamilyData: true,
      redactionReviewer: "agent",
      reviewedAt: "2026-08-24T15:04:05.000Z",
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /real family data/,
  );
});

test("audit data safety rejects unknown classifications at runtime", () => {
  const audit = createAuditInput();
  audit.dataSafety.classification = "invented" as "synthetic";

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /data classification/,
  );
});

test("audit validation rejects omitted safety booleans and non-boolean harm", () => {
  const missingSafety = createAuditInput();
  missingSafety.dataSafety.realFamilyData =
    undefined as unknown as boolean;
  const numericHarm = createAuditInput();
  const applicablePlay = numericHarm.score.plays.find(
    (play) => play.applicability !== "not_applicable",
  );
  assert.ok(applicablePlay);
  applicablePlay.harm = 0 as unknown as boolean;

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: missingSafety,
      }),
    /realFamilyData must be false/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: numericHarm,
      }),
    /harm must be boolean/,
  );
});

test("audit validation rejects unknown status enums at runtime", () => {
  const audit = createAuditInput();
  audit.status = "invented" as "draft";

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /audit status/,
  );

  const readinessAudit = createAuditInput();
  readinessAudit.readiness.status = "invented" as "not_checked";
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: readinessAudit,
      }),
    /readiness status/,
  );

  const resultAudit = createAuditInput();
  resultAudit.readiness.results = [
    {
      gateId: "native-accessibility",
      owner: "apps/mobile/src/lib/accessibility/acceptance-manifest.ts",
      status: "invented" as "pass",
      evidenceRefs: ["owned:package.json"],
    },
  ];
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: resultAudit,
      }),
    /readiness result status/,
  );
});

test("audit validation rejects string values where arrays are required", () => {
  const scopeAudit = createAuditInput();
  scopeAudit.scope.scopeKeys = "x" as unknown as string[];
  const evidenceAudit = createAuditInput();
  evidenceAudit.evidence.satisfiedIds = "x" as unknown as string[];

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: scopeAudit,
      }),
    /scope keys must be an array/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: evidenceAudit,
      }),
    /evidence IDs and artifacts must be arrays/,
  );
});

test("audit validation rejects invented candidate provenance", () => {
  const audit = createAuditInput();
  audit.score.plays[0] = {
    ...audit.score.plays[0],
    provenanceRoutes: ["strategy:onboarding"],
  };

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /provenance/,
  );
});

test("E4 audits require accepted research or production evidence", () => {
  const audit = createAuditInput({
    evidence: {
      level: "E4",
      requiredIds: ["research"],
      satisfiedIds: ["research"],
      artifacts: [
        {
          evidenceId: "research",
          path: "evidence/research.json",
          sha256: "0".repeat(64),
          environment: "test",
          device: "n/a",
          operatingSystem: "n/a",
          state: "research",
          capturedAt: "2026-08-24T15:04:05.000Z",
        },
      ],
      e4Evidence: null,
    },
  });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /E4 evidence/,
  );
});

test("E4 evidence validates source type, ordered windows, and artifact linkage", () => {
  const createE4Audit = (): FlowAuditInput =>
    createAuditInput({
      evidence: {
        level: "E4",
        requiredIds: ["research"],
        satisfiedIds: ["research"],
        artifacts: [
          {
            evidenceId: "research",
            path: "package.json",
            sha256: hashRepositoryFile("package.json"),
            environment: "test",
            device: "n/a",
            operatingSystem: "n/a",
            state: "research",
            capturedAt: "2026-08-24T15:04:05.000Z",
          },
        ],
        e4Evidence: {
          sourceType: "user_research",
          population: "Designated demo participants",
          sampleSize: 5,
          collectionStartedAt: "2026-08-20T00:00:00.000Z",
          collectionEndedAt: "2026-08-21T00:00:00.000Z",
          consentBasis: "Approved research consent",
          acceptedBy: "founder:sidney",
          acceptedAt: "2026-08-24T15:04:05.000Z",
          artifactRefs: ["research"],
        },
      },
    });
  const invalidSource = createE4Audit();
  invalidSource.evidence.e4Evidence!.sourceType =
    "invented" as "user_research";
  const invalidWindow = createE4Audit();
  invalidWindow.evidence.e4Evidence!.collectionEndedAt =
    "2026-08-19T00:00:00.000Z";
  const missingArtifact = createE4Audit();
  missingArtifact.evidence.e4Evidence!.artifactRefs = ["missing"];
  const looseTimestamp = createE4Audit();
  looseTimestamp.evidence.e4Evidence!.collectionStartedAt =
    "August 20, 2026 Z";

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: invalidSource,
      }),
    /E4 source type/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: invalidWindow,
      }),
    /E4 collection window/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: missingArtifact,
      }),
    /E4 artifact ref/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: looseTimestamp,
      }),
    /ISO 8601 UTC/,
  );
});

test("accepted E3 and production-metric E4 audits require complete outcomes", () => {
  const acceptedE3 = createAuditInput({
    status: "accepted",
    acceptance: {
      acceptedBy: "founder:sidney",
      acceptedAt: "2026-08-24T16:00:00.000Z",
      decisionRef: "gh#999",
    },
    evidence: {
      level: "E3",
      requiredIds: ["screen"],
      satisfiedIds: ["screen"],
      artifacts: [
        {
          evidenceId: "screen",
          path: "package.json",
          sha256: hashRepositoryFile("package.json"),
          environment: "test",
          device: "simulator",
          operatingSystem: "iOS",
          state: "reveal",
          capturedAt: "2026-08-24T15:04:05.000Z",
        },
      ],
      e4Evidence: null,
    },
    outcomes: [],
  });
  const productionE4 = structuredClone(acceptedE3);
  productionE4.evidence.level = "E4";
  productionE4.evidence.e4Evidence = {
    sourceType: "production_metric",
    population: "New native families",
    sampleSize: 100,
    collectionStartedAt: "2026-08-20T00:00:00.000Z",
    collectionEndedAt: "2026-08-25T00:00:00.000Z",
    consentBasis: "Approved aggregate telemetry",
    acceptedBy: "founder:sidney",
    acceptedAt: "2026-08-24T16:00:00.000Z",
    artifactRefs: ["screen"],
  };

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: acceptedE3,
      }),
    /outcome manifest/,
  );
  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: productionE4,
      }),
    /collection cannot end after the audit/,
  );
});

test("E1 audits require current hashes for every implementation reference", () => {
  const audit = createAuditInput({ ownedFiles: [] });

  assert.throws(
    () =>
      scoreProductDesignDocument({
        mode: "audit",
        input: audit,
      }),
    /owned file manifest/,
  );
});

test("audit command verifies artifact and owned-file hashes against the repository", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-audit-"));
  mkdirSync(join(root, "evidence"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "evidence", "screen.png"), "rendered");
  writeFileSync(join(root, "src", "flow.ts"), "export const flow = true;");
  const audit = createAuditInput({
    evidence: {
      level: "E1",
      requiredIds: [],
      satisfiedIds: [],
      artifacts: [
        {
          evidenceId: "screen",
          path: "evidence/screen.png",
          sha256: "0".repeat(64),
          environment: "test",
          device: "simulator",
          operatingSystem: "iOS",
          state: "reveal",
          capturedAt: "2026-08-24T15:04:05.000Z",
        },
      ],
      e4Evidence: null,
    },
    ownedFiles: [
      {
        path: "src/flow.ts",
        sha256: "0".repeat(64),
      },
    ],
  });
  const applicablePlay = audit.score.plays.find(
    (play) => play.applicability !== "not_applicable",
  );
  assert.ok(applicablePlay);
  applicablePlay.implementationRefs = ["src/flow.ts"];
  applicablePlay.evidenceRefs = ["owned:src/flow.ts"];

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(
          { mode: "audit", input: audit },
          { repositoryRoot: root },
        ),
      /hash does not match/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("owned-file manifests reject restricted paths before reading them", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-owned-"));
  writeFileSync(join(root, ".env.local"), "not-a-real-secret");
  const audit = createAuditInput({
    ownedFiles: [
      {
        path: ".env.local",
        sha256: "0".repeat(64),
      },
    ],
  });
  const applicablePlay = audit.score.plays.find(
    (play) => play.applicability !== "not_applicable",
  );
  assert.ok(applicablePlay);
  applicablePlay.implementationRefs = [".env.local"];
  applicablePlay.evidenceRefs = ["owned:.env.local"];

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(
          { mode: "audit", input: audit },
          { repositoryRoot: root },
        ),
      /restricted/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("owned-file manifests reject restricted directories behind intermediate symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "product-design-owned-link-"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, ".git", "authority.md"), "restricted");
  symlinkSync(join(root, ".git"), join(root, "linked"), "dir");
  const audit = createAuditInput({
    ownedFiles: [
      {
        path: "linked/authority.md",
        sha256: hashFile(join(root, ".git", "authority.md")),
      },
    ],
  });
  const applicablePlay = audit.score.plays.find(
    (play) => play.applicability !== "not_applicable",
  );
  assert.ok(applicablePlay);
  applicablePlay.implementationRefs = ["linked/authority.md"];
  applicablePlay.evidenceRefs = ["owned:linked/authority.md"];

  try {
    assert.throws(
      () =>
        scoreProductDesignDocument(
          { mode: "audit", input: audit },
          { repositoryRoot: root },
        ),
      /symlink|restricted/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
