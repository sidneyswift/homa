import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  scoreFlowAudit,
  type FlowAuditInput,
  type FlowAuditResult,
} from "./audit-contract.ts";
import {
  ScoreValidationError,
  scoreFlow,
  type FlowScoreInput,
  type PortfolioScoreResult,
  type StrategyId,
  type StrategyScoreResult,
  type FlowScoreResult,
} from "./score-contract.ts";
import {
  type FlowEstimateResult,
} from "./score-estimate.ts";
import {
  scoreEstimateFile,
  type EstimateFileInput,
} from "./score-estimate-files.ts";
import {
  scorePortfolioFiles,
  scoreStrategyFiles,
  type PortfolioFileInput,
} from "./score-portfolio-files.ts";

export type { FlowAuditInput } from "./audit-contract.ts";

export type ScoreCommandDocument =
  | {
      mode: "audit";
      input: FlowAuditInput;
    }
  | {
      mode: "estimate";
      input: EstimateFileInput;
    }
  | {
      mode: "flow";
      input: FlowScoreInput;
    }
  | {
      mode: "portfolio";
      input: PortfolioFileInput;
    }
  | {
      mode: "strategy";
      strategyId: StrategyId;
      input: PortfolioFileInput;
    };

export type ScoreCommandOutput =
  | {
      mode: "audit";
      result: FlowAuditResult;
    }
  | {
      mode: "estimate";
      result: FlowEstimateResult;
    }
  | {
      mode: "flow";
      result: FlowScoreResult;
    }
  | {
      mode: "portfolio";
      result: PortfolioScoreResult;
    }
  | {
      mode: "strategy";
      strategyId: StrategyId;
      result: StrategyScoreResult;
    };

export interface ScoreCommandContext {
  repositoryRoot: string;
  allowUncommittedArtifacts?: boolean;
}

function assertNever(value: never): never {
  const unknownDocument = value as { mode?: unknown };
  throw new ScoreValidationError(
    `unknown scoring mode: ${String(unknownDocument.mode)}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseScoreCommandDocument(
  value: unknown,
): ScoreCommandDocument {
  if (!isRecord(value) || typeof value.mode !== "string") {
    throw new ScoreValidationError(
      "score input must be an object with a mode",
    );
  }
  switch (value.mode) {
    case "audit":
      if (!isRecord(value.input)) {
        throw new ScoreValidationError("audit input must be an object");
      }
      return value as unknown as ScoreCommandDocument;
    case "estimate":
      if (!isRecord(value.input)) {
        throw new ScoreValidationError("estimate input must be an object");
      }
      return value as unknown as ScoreCommandDocument;
    case "flow":
    case "portfolio":
      if (!isRecord(value.input)) {
        throw new ScoreValidationError(
          `${value.mode} input must be an object`,
        );
      }
      return value as unknown as ScoreCommandDocument;
    case "strategy":
      if (
        !isRecord(value.input) ||
        typeof value.strategyId !== "string"
      ) {
        throw new ScoreValidationError(
          "strategy input and strategyId are required",
        );
      }
      return value as unknown as ScoreCommandDocument;
    default:
      throw new ScoreValidationError(
        `unknown scoring mode: ${value.mode}`,
      );
  }
}

export function scoreProductDesignDocument(
  document: ScoreCommandDocument,
  context: ScoreCommandContext = { repositoryRoot: process.cwd() },
): ScoreCommandOutput {
  switch (document.mode) {
    case "audit":
      return {
        mode: "audit",
        result: scoreFlowAudit(document.input, context.repositoryRoot),
      };
    case "estimate":
      return {
        mode: "estimate",
        result: scoreEstimateFile(
          document.input,
          context.repositoryRoot,
          context.allowUncommittedArtifacts ?? false,
        ),
      };
    case "flow":
      return { mode: "flow", result: scoreFlow(document.input) };
    case "portfolio":
      return {
        mode: "portfolio",
        result: scorePortfolioFiles(
          document.input,
          context.repositoryRoot,
          context.allowUncommittedArtifacts ?? false,
        ),
      };
    case "strategy":
      return {
        mode: "strategy",
        strategyId: document.strategyId,
        result: scoreStrategyFiles(
          document.strategyId,
          document.input,
          context.repositoryRoot,
          context.allowUncommittedArtifacts ?? false,
        ),
      };
    default:
      return assertNever(document);
  }
}

function readCommandDocument(path: string): ScoreCommandDocument {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return parseScoreCommandDocument(parsed);
}

function isMainModule(): boolean {
  const scriptPath = process.argv[1];
  return Boolean(
    scriptPath && pathToFileURL(scriptPath).href === import.meta.url,
  );
}

function runCli(): void {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new ScoreValidationError(
      "usage: score-product-design.mts <score-input.json>",
    );
  }
  const output = scoreProductDesignDocument(readCommandDocument(inputPath));
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (isMainModule()) {
  try {
    runCli();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    process.stderr.write(`Product design scoring failed: ${message}\n`);
    process.exitCode = 1;
  }
}
