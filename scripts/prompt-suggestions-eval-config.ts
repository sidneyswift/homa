import { z } from "../apps/web/node_modules/zod/index.js";

export const DEFAULT_PROMPT_SUGGESTIONS_JUDGE_MODEL =
  "anthropic/claude-sonnet-4.6";
export const DEFAULT_PROMPT_SUGGESTIONS_JUDGE_REPEATS = 3;
export const PROMPT_SUGGESTIONS_JUDGE_REPEATS_ENV =
  "HOMA_SUGGESTIONS_JUDGE_REPEATS";

export const PROMPT_SUGGESTIONS_JUDGE_SETTINGS = {
  reasoning: "none",
  maxOutputTokens: 2_048,
  temperature: 0,
} as const;

export const PROMPT_SUGGESTIONS_JUDGE_MAX_JUDGMENTS = 4;
export const PROMPT_SUGGESTIONS_JUDGE_MAX_REASONS = 32;
export const PROMPT_SUGGESTIONS_JUDGE_MAX_REASON_CHARS = 1_000;

export const promptSuggestionJudgmentSchema = z.object({
  suggestionIndex: z.number().int().min(0).max(3),
  relevance: z.boolean(),
  grounding: z.boolean(),
  currentCapability: z.boolean(),
  specificity: z.boolean(),
  nonRedundancy: z.boolean(),
  voice: z.boolean(),
  superiorToGenericFallback: z.boolean(),
  reasons: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(PROMPT_SUGGESTIONS_JUDGE_MAX_REASON_CHARS),
    )
    .max(PROMPT_SUGGESTIONS_JUDGE_MAX_REASONS),
});

export const promptSuggestionFixtureJudgmentSchema = z.object({
  judgments: z
    .array(promptSuggestionJudgmentSchema)
    .max(PROMPT_SUGGESTIONS_JUDGE_MAX_JUDGMENTS),
});

export type PromptSuggestionJudgment = z.infer<
  typeof promptSuggestionJudgmentSchema
>;

export interface PromptSuggestionJudgeAttempt {
  judgments: readonly PromptSuggestionJudgment[] | null;
  judgeCallCount: number;
  structuredRetryCount: number;
}

export interface PromptSuggestionJudgeEnsembleResult {
  judgments: PromptSuggestionJudgment[];
  requestedRepeatCount: number;
  usableRepeatCount: number;
  failedRepeatCount: number;
  operationalFailureRepeatCount: number;
  mappingFailureRepeatCount: number;
  judgeCallCount: number;
  structuredRetryCount: number;
  disagreementCount: number;
  disagreementOpportunityCount: number;
  disagreementRate: number;
}

const PROMPT_SUGGESTION_JUDGE_BOOLEAN_CRITERIA = [
  "relevance",
  "grounding",
  "currentCapability",
  "specificity",
  "nonRedundancy",
  "voice",
  "superiorToGenericFallback",
] as const satisfies readonly (keyof PromptSuggestionJudgment)[];

export class PromptSuggestionJudgeEnsembleError extends Error {
  override readonly name = "PromptSuggestionJudgeEnsembleError";

  constructor() {
    super("Prompt suggestion judge ensemble had fewer than two usable repeats");
  }
}

export function isPromptSuggestionJudgeEnsembleError(
  error: unknown,
): error is PromptSuggestionJudgeEnsembleError {
  return error instanceof PromptSuggestionJudgeEnsembleError;
}

export function strictPromptSuggestionJudgeMajority(
  votes: readonly boolean[],
): boolean {
  return votes.filter(Boolean).length > votes.length / 2;
}

export function aggregatePromptSuggestionJudgeAttempts(
  attempts: readonly PromptSuggestionJudgeAttempt[],
  suggestionCount: number,
): PromptSuggestionJudgeEnsembleResult {
  const usableJudgmentSets: PromptSuggestionJudgment[][] = [];
  let operationalFailureRepeatCount = 0;
  let mappingFailureRepeatCount = 0;

  for (const attempt of attempts) {
    if (attempt.judgments === null) {
      operationalFailureRepeatCount += 1;
      continue;
    }
    if (
      promptSuggestionJudgmentMappingIssues(
        attempt.judgments,
        suggestionCount,
      ).length > 0
    ) {
      mappingFailureRepeatCount += 1;
      continue;
    }
    usableJudgmentSets.push(
      [...attempt.judgments].sort(
        (left, right) => left.suggestionIndex - right.suggestionIndex,
      ),
    );
  }

  if (usableJudgmentSets.length < 2) {
    throw new PromptSuggestionJudgeEnsembleError();
  }

  let disagreementCount = 0;
  const judgments = Array.from({ length: suggestionCount }, (_, index) => {
    const judgmentsForSuggestion = usableJudgmentSets.map(
      (judgmentSet) => judgmentSet[index]!,
    );
    for (const criterion of PROMPT_SUGGESTION_JUDGE_BOOLEAN_CRITERIA) {
      const votes = judgmentsForSuggestion.map(
        (judgment) => judgment[criterion] as boolean,
      );
      if (new Set(votes).size > 1) disagreementCount += 1;
    }
    const votesFor = (
      criterion: (typeof PROMPT_SUGGESTION_JUDGE_BOOLEAN_CRITERIA)[number],
    ): boolean[] =>
      judgmentsForSuggestion.map(
        (judgment) => judgment[criterion] as boolean,
      );

    return {
      suggestionIndex: index,
      relevance:
        strictPromptSuggestionJudgeMajority(votesFor("relevance")),
      grounding:
        strictPromptSuggestionJudgeMajority(votesFor("grounding")),
      currentCapability:
        strictPromptSuggestionJudgeMajority(votesFor("currentCapability")),
      specificity:
        strictPromptSuggestionJudgeMajority(votesFor("specificity")),
      nonRedundancy:
        strictPromptSuggestionJudgeMajority(votesFor("nonRedundancy")),
      voice: strictPromptSuggestionJudgeMajority(votesFor("voice")),
      superiorToGenericFallback: strictPromptSuggestionJudgeMajority(
        votesFor("superiorToGenericFallback"),
      ),
      reasons: [],
    };
  });
  const disagreementOpportunityCount =
    suggestionCount * PROMPT_SUGGESTION_JUDGE_BOOLEAN_CRITERIA.length;

  return {
    judgments,
    requestedRepeatCount: attempts.length,
    usableRepeatCount: usableJudgmentSets.length,
    failedRepeatCount: attempts.length - usableJudgmentSets.length,
    operationalFailureRepeatCount,
    mappingFailureRepeatCount,
    judgeCallCount: attempts.reduce(
      (total, attempt) => total + attempt.judgeCallCount,
      0,
    ),
    structuredRetryCount: attempts.reduce(
      (total, attempt) => total + attempt.structuredRetryCount,
      0,
    ),
    disagreementCount,
    disagreementOpportunityCount,
    disagreementRate:
      disagreementOpportunityCount === 0
        ? 0
        : disagreementCount / disagreementOpportunityCount,
  };
}

export type PromptSuggestionJudgmentMappingIssue =
  | "duplicate_index"
  | "out_of_range_index"
  | "extra_judgment"
  | "omitted_judgment";

export function promptSuggestionJudgmentMappingIssues(
  judgments: readonly Pick<PromptSuggestionJudgment, "suggestionIndex">[],
  suggestionCount: number,
): PromptSuggestionJudgmentMappingIssue[] {
  const issues: PromptSuggestionJudgmentMappingIssue[] = [];
  const indexes = judgments.map((judgment) => judgment.suggestionIndex);
  if (new Set(indexes).size !== indexes.length) {
    issues.push("duplicate_index");
  }
  if (indexes.some((index) => index < 0 || index >= suggestionCount)) {
    issues.push("out_of_range_index");
  }
  if (judgments.length > suggestionCount) {
    issues.push("extra_judgment");
  }
  const coveredIndexes = new Set(
    indexes.filter((index) => index >= 0 && index < suggestionCount),
  );
  if (coveredIndexes.size < suggestionCount) {
    issues.push("omitted_judgment");
  }
  return issues;
}

/** Keeps the paid eval override explicit without coupling it to production. */
export function resolvePromptSuggestionsJudgeModel(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  return environment.HOMA_SUGGESTIONS_JUDGE_MODEL
    ?? DEFAULT_PROMPT_SUGGESTIONS_JUDGE_MODEL;
}

export function resolvePromptSuggestionsJudgeRepeats(
  environment: Readonly<Record<string, string | undefined>>,
): number {
  const configured = environment[PROMPT_SUGGESTIONS_JUDGE_REPEATS_ENV];
  if (!configured) return DEFAULT_PROMPT_SUGGESTIONS_JUDGE_REPEATS;
  const parsed = Number(configured);
  return Number.isInteger(parsed)
      && parsed >= 3
      && parsed <= 9
      && parsed % 2 === 1
    ? parsed
    : DEFAULT_PROMPT_SUGGESTIONS_JUDGE_REPEATS;
}

export async function runPromptSuggestionJudgeWithStructuredRetry<T>(
  operation: () => Promise<T>,
  isStructuredFailure: (error: unknown) => boolean,
  onRetry: () => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isStructuredFailure(error)) throw error;
    onRetry();
    return operation();
  }
}
