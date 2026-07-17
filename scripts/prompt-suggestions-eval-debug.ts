import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  PROMPT_SUGGESTION_SCENARIOS,
  type PromptSuggestionScenario,
} from "../apps/web/lib/chat-suggestions/generate";

export const PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV =
  "HOMA_SUGGESTIONS_EVAL_DEBUG_FILE";

export const PROMPT_SUGGESTION_JUDGE_CRITERIA = [
  "relevance",
  "grounding",
  "currentCapability",
  "specificity",
  "nonRedundancy",
  "voice",
  "superiorToGenericFallback",
] as const;

export type PromptSuggestionJudgeCriterion =
  (typeof PROMPT_SUGGESTION_JUDGE_CRITERIA)[number];

const OPERATIONAL_FAILURE_CATEGORIES = [
  "structured_output",
  "authentication",
  "rate_limit",
  "model_configuration",
  "provider_api",
  "retry_exhausted",
  "timeout",
  "unknown",
] as const;
const STRUCTURED_OUTPUT_FAILURE_CATEGORIES = [
  "parse_failure",
  "schema_validation_failure",
  "empty_or_no_output",
  "unknown_structured_failure",
] as const;
const JUDGMENT_MAPPING_FAILURES = [
  "duplicate_index",
  "out_of_range_index",
  "extra_judgment",
  "omitted_judgment",
] as const;
const DIAGNOSTIC_FILENAME_PATTERN =
  /^iteration-[1-9][0-9]*-diagnostics\.json$/u;
const FIXED_SCENARIO_IDS = new Set<string>(PROMPT_SUGGESTION_SCENARIOS);
const FIXED_EVAL_FAILURE_CODES = new Set<string>([
  "producer.fallback",
  "producer.strict_normalization_fallback",
  "suggestion.forbidden_claim_pattern",
  ...OPERATIONAL_FAILURE_CATEGORIES.flatMap((category) => [
    `producer.operational.${category}`,
    `judge.operational.${category}`,
  ]),
  ...STRUCTURED_OUTPUT_FAILURE_CATEGORIES.map(
    (category) => `producer.structured.${category}`,
  ),
  ...JUDGMENT_MAPPING_FAILURES.map(
    (failure) => `judge.mapping.${failure}`,
  ),
  ...PROMPT_SUGGESTION_JUDGE_CRITERIA.map(
    (criterion) => `criterion.${criterion}`,
  ),
]);

export interface PromptSuggestionEvalDebugJudgment {
  suggestionIndex: number;
  relevance: boolean;
  grounding: boolean;
  currentCapability: boolean;
  specificity: boolean;
  nonRedundancy: boolean;
  voice: boolean;
  superiorToGenericFallback: boolean;
  failureCodes: string[];
  sanitizedReasons: string[];
}

export interface PromptSuggestionEvalDebugFixture {
  fixtureId: string;
  suggestions: string[];
  scenarioId: PromptSuggestionScenario | null;
  source: "model" | "fallback";
  failureCodes: string[];
  sanitizedReasons: string[];
  judgments: PromptSuggestionEvalDebugJudgment[];
}

export interface PromptSuggestionEvalDebugArtifact {
  version: 2;
  fixtureCount: number;
  fixtures: PromptSuggestionEvalDebugFixture[];
}

export type PromptSuggestionEvalDebugWriteStatus =
  | "disabled"
  | "fake_corpus_required"
  | "invalid_path"
  | "written";

type DebugFileWriter = (targetPath: string, json: string) => void;

function defaultDebugFileWriter(targetPath: string, json: string): void {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, json, { encoding: "utf8", mode: 0o600 });
}

function debugTargetPath(
  repoRoot: string,
  environment: Readonly<Record<string, string | undefined>>,
): string | null {
  const configuredPath =
    environment[PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV];
  if (!configuredPath) return null;

  const allowedRoot = path.resolve(
    repoRoot,
    ".context/compound-engineering/ce-optimize/prompt-suggestions",
  );
  const targetPath = path.resolve(repoRoot, configuredPath);
  if (
    path.dirname(targetPath) !== allowedRoot
    || !DIAGNOSTIC_FILENAME_PATTERN.test(path.basename(targetPath))
  ) {
    return "";
  }
  return targetPath;
}

function fixedCodes(codes: readonly string[]): string[] {
  return [...new Set(codes.filter((code) =>
    FIXED_EVAL_FAILURE_CODES.has(code)
  ))];
}

function serializableDebugArtifact(
  artifact: PromptSuggestionEvalDebugArtifact,
): PromptSuggestionEvalDebugArtifact {
  return {
    version: 2,
    fixtureCount: artifact.fixtures.length,
    fixtures: artifact.fixtures.map((fixture) => {
      const failureCodes = fixedCodes(fixture.failureCodes);
      return {
        fixtureId: fixture.fixtureId,
        suggestions: [...fixture.suggestions],
        scenarioId:
          fixture.scenarioId !== null
            && FIXED_SCENARIO_IDS.has(fixture.scenarioId)
            ? fixture.scenarioId
            : null,
        source: fixture.source,
        failureCodes,
        sanitizedReasons:
          fixedSanitizedPromptSuggestionEvalReasons(failureCodes),
        judgments: fixture.judgments.map((judgment) => {
          const judgmentFailureCodes = fixedCodes(judgment.failureCodes);
          return {
            suggestionIndex: judgment.suggestionIndex,
            relevance: judgment.relevance,
            grounding: judgment.grounding,
            currentCapability: judgment.currentCapability,
            specificity: judgment.specificity,
            nonRedundancy: judgment.nonRedundancy,
            voice: judgment.voice,
            superiorToGenericFallback:
              judgment.superiorToGenericFallback,
            failureCodes: judgmentFailureCodes,
            sanitizedReasons:
              fixedSanitizedPromptSuggestionEvalReasons(
                judgmentFailureCodes,
              ),
          };
        }),
      };
    }),
  };
}

export function fixedJudgeFailureCodes(
  judgment: Pick<
    PromptSuggestionEvalDebugJudgment,
    PromptSuggestionJudgeCriterion
  >,
): string[] {
  return PROMPT_SUGGESTION_JUDGE_CRITERIA.filter(
    (criterion) => !judgment[criterion],
  ).map((criterion) => `criterion.${criterion}`);
}

export function fixedSanitizedPromptSuggestionEvalReasons(
  failureCodes: readonly string[],
): string[] {
  return fixedCodes(failureCodes).map(
    (code) => `Fixed diagnostic: ${code}`,
  );
}

export function writePromptSuggestionEvalDebugArtifact(
  input: {
    environment: Readonly<Record<string, string | undefined>>;
    repoRoot: string;
    fakeCorpusValidated: boolean;
    artifact: PromptSuggestionEvalDebugArtifact;
  },
  writeFile: DebugFileWriter = defaultDebugFileWriter,
): PromptSuggestionEvalDebugWriteStatus {
  const targetPath = debugTargetPath(input.repoRoot, input.environment);
  if (targetPath === null) return "disabled";
  if (!input.fakeCorpusValidated) return "fake_corpus_required";
  if (targetPath === "") return "invalid_path";

  const json = `${JSON.stringify(
    serializableDebugArtifact(input.artifact),
    null,
    2,
  )}\n`;
  writeFile(targetPath, json);
  return "written";
}
