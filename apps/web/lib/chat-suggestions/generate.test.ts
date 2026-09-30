import { HOMA_MODEL, homaModelSettings } from "../../agent/model";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PROMPT_SUGGESTION_FALLBACK,
  PROMPT_SUGGESTIONS_PROMPT_VERSION,
  createPromptSuggestionAssistantFingerprint,
  promptSuggestionListSchema,
  type PromptSuggestionRequest,
} from "./contract";
import {
  PROMPT_SUGGESTION_PRODUCER_SETTINGS,
  PROMPT_SUGGESTION_SCENARIOS,
  PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO,
  generatePromptSuggestionSet,
  promptSuggestionScenarioOutputSchema,
} from "./generate";
import {
  PROMPT_SUGGESTION_FALLBACK_SWEEP_LABELS,
  PROMPT_SUGGESTION_FIXTURES,
  selectPromptSuggestionFixturesByIdFilter,
} from "../../../../scripts/fixtures/prompt-suggestions";
import {
  DEFAULT_PROMPT_SUGGESTIONS_JUDGE_REPEATS,
  DEFAULT_PROMPT_SUGGESTIONS_JUDGE_MODEL,
  PROMPT_SUGGESTIONS_JUDGE_SETTINGS,
  aggregatePromptSuggestionJudgeAttempts,
  isPromptSuggestionJudgeEnsembleError,
  promptSuggestionFixtureJudgmentSchema,
  promptSuggestionJudgmentMappingIssues,
  resolvePromptSuggestionsJudgeRepeats,
  resolvePromptSuggestionsJudgeModel,
  runPromptSuggestionJudgeWithStructuredRetry,
  strictPromptSuggestionJudgeMajority,
} from "../../../../scripts/prompt-suggestions-eval-config";
import {
  fixedJudgeFailureCodes,
} from "../../../../scripts/prompt-suggestions-eval-debug";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const PRIVATE_CONVERSATION_TEXT = "Maya needs help with private reading notes";
const REQUEST = {
  assistantMessageId: "turn_1:assistant",
  messages: [
    { role: "user", text: PRIVATE_CONVERSATION_TEXT },
    {
      role: "assistant",
      text: "I can make a short reading activity with picture clues.",
    },
  ],
} satisfies PromptSuggestionRequest;
const ASSISTANT_TEXT = REQUEST.messages.at(-1)?.text ?? "";
const ROUTE_SOURCE = readFileSync(
  new URL("../../app/api/chat/suggestions/route.ts", import.meta.url),
  "utf8",
);
const GENERATOR_SOURCE = readFileSync(
  new URL("./generate.ts", import.meta.url),
  "utf8",
);
const LIVE_EVAL_SOURCE = readFileSync(
  new URL("../../../../scripts/prompt-suggestions-eval.mts", import.meta.url),
  "utf8",
);
const PROMPT_SOURCE = readFileSync(
  new URL("../../agent/prompt-suggestions.md", import.meta.url),
  "utf8",
);
const PACKAGE_SOURCE = readFileSync(
  new URL("../../../../package.json", import.meta.url),
  "utf8",
);

function judgeResult(suggestionIndex: number, reasons = ["fixed reason"]) {
  return {
    suggestionIndex,
    relevance: true,
    grounding: true,
    currentCapability: true,
    specificity: true,
    nonRedundancy: true,
    voice: true,
    superiorToGenericFallback: true,
    reasons,
  };
}

function judgeAttempt(
  judgments: ReturnType<typeof judgeResult>[] | null,
  judgeCallCount = 1,
) {
  return {
    judgments,
    judgeCallCount,
    structuredRetryCount: 0,
  };
}

describe("prompt suggestion generation", () => {
  it("shares the producer budget with the live eval and overrides none for Astra", () => {
    assert.deepEqual(PROMPT_SUGGESTION_PRODUCER_SETTINGS, {
      reasoning: "none",
      maxOutputTokens: 1_024,
    });
    assert.equal({ ...PROMPT_SUGGESTION_PRODUCER_SETTINGS, ...homaModelSettings(HOMA_MODEL) }.reasoning, "medium");
    assert.equal({ ...PROMPT_SUGGESTION_PRODUCER_SETTINGS, ...homaModelSettings("test/specialist") }.reasoning, "none");
    for (const source of [GENERATOR_SOURCE, LIVE_EVAL_SOURCE]) {
      assert.equal(
        source.match(/\.\.\.PROMPT_SUGGESTION_PRODUCER_SETTINGS/gu)?.length,
        1,
      );
    }
  });

  it("uses the stable eval-only judge default, settings, and env override", () => {
    assert.equal(
      DEFAULT_PROMPT_SUGGESTIONS_JUDGE_MODEL,
      "anthropic/claude-sonnet-4.6",
    );
    assert.deepEqual(PROMPT_SUGGESTIONS_JUDGE_SETTINGS, {
      reasoning: "none",
      maxOutputTokens: 2_048,
      temperature: 0,
    });
    assert.equal(
      resolvePromptSuggestionsJudgeModel({}),
      DEFAULT_PROMPT_SUGGESTIONS_JUDGE_MODEL,
    );
    assert.equal(
      resolvePromptSuggestionsJudgeModel({
        HOMA_SUGGESTIONS_JUDGE_MODEL: "test/judge-override",
      }),
      "test/judge-override",
    );
    assert.equal(
      LIVE_EVAL_SOURCE.match(/\.\.\.PROMPT_SUGGESTIONS_JUDGE_SETTINGS/gu)
        ?.length,
      1,
    );
    assert.match(
      LIVE_EVAL_SOURCE,
      /resolvePromptSuggestionsJudgeModel\(process\.env\)/u,
    );
  });

  it("defaults the paid judge ensemble to three odd repeats", () => {
    assert.equal(DEFAULT_PROMPT_SUGGESTIONS_JUDGE_REPEATS, 3);
    assert.equal(resolvePromptSuggestionsJudgeRepeats({}), 3);
    assert.equal(
      resolvePromptSuggestionsJudgeRepeats({
        HOMA_SUGGESTIONS_JUDGE_REPEATS: "5",
      }),
      5,
    );
    for (const invalidValue of ["1", "2", "4", "10", "private"]) {
      assert.equal(
        resolvePromptSuggestionsJudgeRepeats({
          HOMA_SUGGESTIONS_JUDGE_REPEATS: invalidValue,
        }),
        3,
      );
    }
    assert.match(
      LIVE_EVAL_SOURCE,
      /resolvePromptSuggestionsJudgeRepeats\(process\.env\)/u,
    );
  });

  it("aggregates majority true and false without a tie state", () => {
    assert.equal(strictPromptSuggestionJudgeMajority([true, true, false]), true);
    assert.equal(strictPromptSuggestionJudgeMajority([false, false, true]), false);
    assert.equal(strictPromptSuggestionJudgeMajority([true, false]), false);

    const result = aggregatePromptSuggestionJudgeAttempts(
      [
        judgeAttempt([
          { ...judgeResult(0), voice: false },
        ]),
        judgeAttempt([
          { ...judgeResult(0), grounding: false, voice: false },
        ]),
        judgeAttempt([
          judgeResult(0),
        ]),
      ],
      1,
    );

    assert.equal(result.judgments[0]?.grounding, true);
    assert.equal(result.judgments[0]?.voice, false);
    assert.deepEqual(result.judgments[0]?.reasons, []);
    assert.deepEqual(fixedJudgeFailureCodes(result.judgments[0]!), [
      "criterion.voice",
    ]);
    assert.equal(result.disagreementCount, 2);
    assert.equal(result.disagreementOpportunityCount, 7);
  });

  it("keeps two usable judgments when one repeat fails", () => {
    const result = aggregatePromptSuggestionJudgeAttempts(
      [
        judgeAttempt(null),
        judgeAttempt([judgeResult(0)]),
        judgeAttempt([judgeResult(0)]),
      ],
      1,
    );

    assert.equal(result.requestedRepeatCount, 3);
    assert.equal(result.usableRepeatCount, 2);
    assert.equal(result.failedRepeatCount, 1);
    assert.equal(result.judgeCallCount, 3);
    assert.equal(result.judgments[0]?.relevance, true);
  });

  it("fails content-free when fewer than two judgments are usable", () => {
    const privateReason = `private ${PRIVATE_CONVERSATION_TEXT}`;
    assert.throws(
      () =>
        aggregatePromptSuggestionJudgeAttempts(
          [
            judgeAttempt(null),
            judgeAttempt(null),
            judgeAttempt([judgeResult(0, [privateReason])]),
          ],
          1,
        ),
      (error: unknown) =>
        isPromptSuggestionJudgeEnsembleError(error)
        && !JSON.stringify(error).includes(privateReason),
    );
  });

  it("excludes mapping-inconsistent repeats before majority voting", () => {
    const result = aggregatePromptSuggestionJudgeAttempts(
      [
        judgeAttempt([judgeResult(1)]),
        judgeAttempt([judgeResult(0)]),
        judgeAttempt([judgeResult(0)]),
      ],
      1,
    );

    assert.equal(result.usableRepeatCount, 2);
    assert.equal(result.mappingFailureRepeatCount, 1);
    assert.equal(result.judgments[0]?.suggestionIndex, 0);
  });

  it("discards raw judge reasons from ensemble diagnostics", () => {
    const privateReason = `private ${PRIVATE_CONVERSATION_TEXT}`;
    const result = aggregatePromptSuggestionJudgeAttempts(
      [
        judgeAttempt([judgeResult(0, [privateReason])]),
        judgeAttempt([judgeResult(0, [privateReason])]),
        judgeAttempt([judgeResult(0, [privateReason])]),
      ],
      1,
    );

    assert.equal(JSON.stringify(result).includes(privateReason), false);
    assert.deepEqual(result.judgments[0]?.reasons, []);
  });

  it("defines the calibrated short-label rubric with non-corpus examples", () => {
    const judgePromptSource = LIVE_EVAL_SOURCE.match(
      /const JUDGE_SYSTEM_PROMPT = `([\s\S]*?)`;/u,
    )?.[1] ?? "";
    for (const requiredText of [
      "Grounding may come from the full bounded conversation and fake family context",
      "A short verb plus concrete object is specific",
      "terse imperative parent-to-Homa requests",
      "Emailing or revising a newly created artifact is new work",
      "Current capability follows the supplied allowed categories",
      "Superior to fallback is true for any concrete",
      "Planner-day placement and calendar writes are unavailable",
      "Reasons must not quote suggestion or conversation text",
    ]) {
      assert.match(judgePromptSource, new RegExp(requiredText, "u"));
    }
    assert.equal(
      judgePromptSource.match(/Calibration example (?:PASS|FAIL)/gu)?.length,
      5,
    );
    for (const fixture of PROMPT_SUGGESTION_FIXTURES) {
      for (const goldSuggestion of fixture.goldSuggestions) {
        assert.equal(judgePromptSource.includes(goldSuggestion), false);
      }
    }
  });

  it("retries a structured judge failure exactly once and reports the retry", async () => {
    const privateError = new Error(`private ${PRIVATE_CONVERSATION_TEXT}`);
    let calls = 0;
    let retries = 0;
    const result = await runPromptSuggestionJudgeWithStructuredRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw privateError;
        return "ok";
      },
      (error) => error === privateError,
      () => {
        retries += 1;
      },
    );

    assert.equal(result, "ok");
    assert.equal(calls, 2);
    assert.equal(retries, 1);
  });

  it("does not retry non-structured failures or expose private errors", async () => {
    const privateError = new Error(`private ${PRIVATE_CONVERSATION_TEXT}`);
    let calls = 0;
    let retries = 0;
    const loggedArguments: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...argumentsToLog: unknown[]) => {
      loggedArguments.push(argumentsToLog);
    };

    try {
      await assert.rejects(
        runPromptSuggestionJudgeWithStructuredRetry(
          async () => {
            calls += 1;
            throw privateError;
          },
          () => false,
          () => {
            retries += 1;
          },
        ),
        privateError,
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(calls, 1);
    assert.equal(retries, 0);
    assert.equal(
      JSON.stringify(loggedArguments).includes(PRIVATE_CONVERSATION_TEXT),
      false,
    );
  });

  it("stops after one explicit structured retry", async () => {
    const structuredError = new Error("fixed structured failure");
    let calls = 0;
    let retries = 0;

    await assert.rejects(
      runPromptSuggestionJudgeWithStructuredRetry(
        async () => {
          calls += 1;
          throw structuredError;
        },
        () => true,
        () => {
          retries += 1;
        },
      ),
      structuredError,
    );

    assert.equal(calls, 2);
    assert.equal(retries, 1);
    assert.match(LIVE_EVAL_SOURCE, /judge structured retries:/u);
  });

  it("shares the scenario schema and deterministic template map with the live eval", () => {
    assert.deepEqual(PROMPT_SUGGESTION_SCENARIOS, [
      "email_worksheet",
      "email_word_cards",
      "email_summary",
      "revise_material",
      "create_reading_game",
      "create_math_game",
      "create_animal_game",
      "create_counting_game",
      "create_short_passage",
      "create_practice_page",
      "explain_next",
      "compare_options",
      "show_next_skill",
      "email_hours",
      "email_sources",
      "set_reminder",
      "choose_activity",
    ]);
    for (const source of [GENERATOR_SOURCE, LIVE_EVAL_SOURCE]) {
      assert.equal(
        source.match(/schema:\s*promptSuggestionScenarioOutputSchema/gu)
          ?.length,
        1,
      );
      assert.match(
        source,
        /PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO\[/u,
      );
    }
  });

  it("asks for one scenario without exposing model-authored UI text", () => {
    assert.match(PROMPT_SOURCE, /Choose exactly one scenario/u);
    assert.match(PROMPT_SOURCE, /Return only its scenario key/u);
    assert.match(PROMPT_SOURCE, /must not write the UI label/u);
    assert.match(PROMPT_SOURCE, /Current Homa capabilities/u);
    assert.match(PROMPT_SOURCE, /completed work/u);
    assert.match(PROMPT_SOURCE, /untrusted evidence/u);
    assert.match(PROMPT_SOURCE, /Planner or external calendar/u);
    assert.match(PROMPT_SOURCE, /explicit nouns, skills, or interests/u);
    assert.match(PROMPT_SOURCE, /more concrete practice scenario/u);
    assert.match(PROMPT_SOURCE, /explicit weekly, total, or summary/u);
    assert.match(PROMPT_SOURCE, /genuine unresolved choice/u);
    assert.match(PROMPT_SOURCE, /clearly unresolved next step/u);
    for (const label of Object.values(PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO)) {
      assert.equal(PROMPT_SOURCE.includes(label), false);
    }
    for (const fixture of PROMPT_SUGGESTION_FIXTURES) {
      assert.equal(PROMPT_SOURCE.includes(fixture.id), false);
    }
  });

  it("captures generous bounded judge diagnostics with every criterion required", () => {
    const formerlyOversizedReasons = Array.from(
      { length: 12 },
      () => "x".repeat(600),
    );
    assert.equal(
      promptSuggestionFixtureJudgmentSchema.safeParse({
        judgments: [
          judgeResult(0, formerlyOversizedReasons),
          judgeResult(1),
          judgeResult(2),
          judgeResult(3),
        ],
      }).success,
      true,
    );
    assert.equal(
      promptSuggestionFixtureJudgmentSchema.safeParse({
        judgments: [judgeResult(0, Array.from({ length: 33 }, () => "x"))],
      }).success,
      false,
    );
    assert.equal(
      promptSuggestionFixtureJudgmentSchema.safeParse({
        judgments: [judgeResult(0, ["x".repeat(1_001)])],
      }).success,
      false,
    );
    const missingCriterion = judgeResult(0);
    Reflect.deleteProperty(missingCriterion, "voice");
    assert.equal(
      promptSuggestionFixtureJudgmentSchema.safeParse({
        judgments: [missingCriterion],
      }).success,
      false,
    );
  });

  it("marks duplicate, extra, omitted, and out-of-range judge mappings malformed", () => {
    assert.deepEqual(
      promptSuggestionJudgmentMappingIssues(
        [judgeResult(0), judgeResult(1)],
        2,
      ),
      [],
    );
    assert.deepEqual(
      promptSuggestionJudgmentMappingIssues(
        [judgeResult(0), judgeResult(0)],
        2,
      ),
      ["duplicate_index", "omitted_judgment"],
    );
    assert.deepEqual(
      promptSuggestionJudgmentMappingIssues(
        [judgeResult(0), judgeResult(1), judgeResult(2)],
        2,
      ),
      ["out_of_range_index", "extra_judgment"],
    );
    assert.deepEqual(
      promptSuggestionJudgmentMappingIssues([judgeResult(0)], 2),
      ["omitted_judgment"],
    );
  });

  it("selects only explicit fixture ids in deterministic filter order", () => {
    assert.deepEqual(
      selectPromptSuggestionFixturesByIdFilter(undefined).map(
        (fixture) => fixture.id,
      ),
      PROMPT_SUGGESTION_FIXTURES.map((fixture) => fixture.id),
    );
    assert.deepEqual(
      selectPromptSuggestionFixturesByIdFilter(
        "research-current-rule,worksheet-created,hours-math-already-logged",
      ).map((fixture) => fixture.id),
      [
        "research-current-rule",
        "worksheet-created",
        "hours-math-already-logged",
      ],
    );
    for (const invalidFilter of [
      "unknown-fixture",
      "worksheet-created,worksheet-created",
      "worksheet-created,,research-current-rule",
    ]) {
      assert.throws(
        () => selectPromptSuggestionFixturesByIdFilter(invalidFilter),
        /fixture id filter is invalid/u,
      );
    }
  });

  it("keeps every human gold set strict, unique, and outside forbidden patterns", () => {
    assert.equal(PROMPT_SUGGESTION_FIXTURES.length, 20);
    for (const fixture of PROMPT_SUGGESTION_FIXTURES) {
      assert.equal(
        promptSuggestionListSchema.safeParse(fixture.goldSuggestions).success,
        true,
        `${fixture.id}: gold suggestions must satisfy the final contract`,
      );
      for (const suggestion of fixture.goldSuggestions) {
        assert.equal(
          fixture.forbiddenClaimPatterns.some((pattern) =>
            new RegExp(pattern, "iu").test(suggestion)
          ),
          false,
          `${fixture.id}: gold suggestion matched a forbidden pattern`,
        );
      }
    }
  });

  it("keeps every negative calibration label strict and distinct from gold", () => {
    const knownCriteria = new Set([
      "relevance",
      "grounding",
      "currentCapability",
      "specificity",
      "nonRedundancy",
      "voice",
      "superiorToGenericFallback",
    ]);
    for (const fixture of PROMPT_SUGGESTION_FIXTURES) {
      assert.equal(
        promptSuggestionListSchema.safeParse([fixture.badSuggestion]).success,
        true,
        `${fixture.id}: bad suggestion must satisfy the final contract`,
      );
      assert.equal(
        fixture.goldSuggestions.some(
          (goldSuggestion) =>
            goldSuggestion.toLocaleLowerCase("en-US")
            === fixture.badSuggestion.toLocaleLowerCase("en-US"),
        ),
        false,
        `${fixture.id}: bad suggestion must differ from gold`,
      );
      assert.ok(fixture.badSuggestionExpectedFailures.length > 0);
      assert.equal(
        new Set(fixture.badSuggestionExpectedFailures).size,
        fixture.badSuggestionExpectedFailures.length,
      );
      assert.equal(
        fixture.badSuggestionExpectedFailures.every((criterion) =>
          knownCriteria.has(criterion)
        ),
        true,
      );
    }
  });

  it("exposes a producer-free judge-gold package mode", () => {
    assert.match(LIVE_EVAL_SOURCE, /"--judge-gold"/u);
    assert.match(LIVE_EVAL_SOURCE, /async function runGoldJudge/u);
    assert.match(LIVE_EVAL_SOURCE, /criterion failures:/u);
    assert.match(
      PACKAGE_SOURCE,
      /"eval:prompt-suggestions:judge-gold":\s*"tsx scripts\/prompt-suggestions-eval\.mts --judge-gold"/u,
    );
    const goldModeSource = LIVE_EVAL_SOURCE.match(
      /async function runGoldJudge[\s\S]*?(?=\nasync function runLiveEval)/u,
    )?.[0] ?? "";
    assert.match(goldModeSource, /judgeSuggestions/u);
    assert.doesNotMatch(goldModeSource, /produceSuggestions/u);
  });

  it("exposes a private producer-free judge-negative package mode", () => {
    assert.match(LIVE_EVAL_SOURCE, /"--judge-negative"/u);
    assert.match(LIVE_EVAL_SOURCE, /async function runNegativeJudge/u);
    for (const reportLabel of [
      "negative rejection rate:",
      "false-accept fixtures:",
      "criteria missed:",
      "operational failures:",
    ]) {
      assert.match(LIVE_EVAL_SOURCE, new RegExp(reportLabel, "u"));
    }
    assert.match(
      PACKAGE_SOURCE,
      /"eval:prompt-suggestions:judge-negative":\s*"tsx scripts\/prompt-suggestions-eval\.mts --judge-negative"/u,
    );
    const negativeModeSource = LIVE_EVAL_SOURCE.match(
      /async function runNegativeJudge[\s\S]*?(?=\nasync function runLiveEval)/u,
    )?.[0] ?? "";
    assert.match(negativeModeSource, /judgeSuggestions/u);
    assert.doesNotMatch(negativeModeSource, /produceSuggestions/u);
    assert.doesNotMatch(
      negativeModeSource,
      /console\.(?:log|error)\([^)]*(?:badSuggestion|transcript)/u,
    );
    assert.doesNotMatch(
      negativeModeSource,
      /JSON\.stringify\(fixture/u,
    );
  });

  it("keeps every generic fallback sweep label strict and id-addressable", () => {
    assert.deepEqual(PROMPT_SUGGESTION_FALLBACK_SWEEP_LABELS, [
      { id: "fallback-1", label: "Explain next step" },
      { id: "fallback-2", label: "Show me next step" },
      { id: "fallback-3", label: "Suggest next step" },
      { id: "fallback-4", label: "Give me one option" },
      { id: "fallback-5", label: "Help me use this" },
      { id: "fallback-6", label: "Show another option" },
    ]);
    for (const item of PROMPT_SUGGESTION_FALLBACK_SWEEP_LABELS) {
      assert.equal(
        promptSuggestionListSchema.safeParse([item.label]).success,
        true,
      );
    }
  });

  it("exposes a batched producer-free fallback sweep mode", () => {
    assert.match(LIVE_EVAL_SOURCE, /"--judge-fallback-sweep"/u);
    assert.match(LIVE_EVAL_SOURCE, /async function runFallbackSweepJudge/u);
    assert.match(
      LIVE_EVAL_SOURCE,
      /PROMPT_SUGGESTIONS_JUDGE_MAX_JUDGMENTS/u,
    );
    for (const reportLabel of [
      "fallback sweep fixtures:",
      "fallback sweep operational failures:",
      "fallback sweep mapping retries:",
      "criteria failures:",
      "pass rate:",
    ]) {
      assert.match(LIVE_EVAL_SOURCE, new RegExp(reportLabel, "u"));
    }
    assert.match(
      PACKAGE_SOURCE,
      /"eval:prompt-suggestions:judge-fallback-sweep":\s*"tsx scripts\/prompt-suggestions-eval\.mts --judge-fallback-sweep"/u,
    );
    const sweepModeSource = LIVE_EVAL_SOURCE.match(
      /async function runFallbackSweepJudge[\s\S]*?(?=\nasync function runLiveEval)/u,
    )?.[0] ?? "";
    assert.match(sweepModeSource, /judgeSuggestions/u);
    assert.doesNotMatch(sweepModeSource, /produceSuggestions/u);
    assert.doesNotMatch(
      sweepModeSource,
      /console\.(?:log|error)\([^)]*item\.label/u,
    );
    assert.doesNotMatch(sweepModeSource, /JSON\.stringify\(fixture/u);
  });

  it("uses the current AI SDK structured output API in production and live eval", () => {
    for (const [source, expectedCalls] of [
      [GENERATOR_SOURCE, 1],
      [LIVE_EVAL_SOURCE, 2],
    ] as const) {
      assert.match(
        source,
        /import\s*\{[^}]*\bgenerateText\b[^}]*\}\s*from\s*"[^"]*ai[^"]*"/u,
      );
      assert.match(
        source,
        /import\s*\{[^}]*\bOutput\b[^}]*\}\s*from\s*"[^"]*ai[^"]*"/u,
      );
      assert.equal(source.match(/\bgenerateText\(\{/gu)?.length, expectedCalls);
      assert.equal(
        source.match(/output:\s*Output\.object\(\{\s*schema:/gu)?.length,
        expectedCalls,
      );
      assert.match(source, /result\.output/u);
      assert.doesNotMatch(source, /\bgenerateObject\b/u);
      assert.doesNotMatch(source, /result\.object/u);
    }
  });

  it("keeps live eval diagnostics fixed-category and content-free", () => {
    assert.match(
      LIVE_EVAL_SOURCE,
      /NoObjectGeneratedError\.isInstance\(error\)/u,
    );
    assert.match(LIVE_EVAL_SOURCE, /APICallError\.isInstance\(error\)/u);
    assert.match(LIVE_EVAL_SOURCE, /error\.name/u);
    assert.match(LIVE_EVAL_SOURCE, /operational failures:/u);
    assert.doesNotMatch(
      LIVE_EVAL_SOURCE,
      /error\.(?:message|text|response|body)/u,
    );
    assert.doesNotMatch(
      LIVE_EVAL_SOURCE,
      /(?:JSON\.stringify|String)\((?:error|cause)\)|\$\{(?:error|cause)\}/u,
    );
    assert.equal(LIVE_EVAL_SOURCE.match(/error\.cause/gu)?.length, 1);
    assert.match(
      LIVE_EVAL_SOURCE,
      /NoObjectGeneratedError\.isInstance\(error\)[\s\S]{0,160}const cause = error\.cause/u,
    );
    for (const errorClass of [
      "JSONParseError",
      "TypeValidationError",
      "NoOutputGeneratedError",
      "NoContentGeneratedError",
      "EmptyResponseBodyError",
    ]) {
      assert.match(
        LIVE_EVAL_SOURCE,
        new RegExp(`${errorClass}\\.isInstance\\(cause\\)`, "u"),
      );
    }
    for (const fixedCategory of [
      "parse_failure",
      "schema_validation_failure",
      "empty_or_no_output",
      "unknown_structured_failure",
    ]) {
      assert.match(LIVE_EVAL_SOURCE, new RegExp(`"${fixedCategory}"`, "u"));
    }
    assert.doesNotMatch(
      LIVE_EVAL_SOURCE,
      /cause\.(?:message|text|response|body|value)|issue\.path/u,
    );
    assert.match(
      LIVE_EVAL_SOURCE,
      /Reflect\.get\(issueContainer, "issues"\)/u,
    );
    assert.match(LIVE_EVAL_SOURCE, /Reflect\.get\(issue, "code"\)/u);
    assert.doesNotMatch(
      LIVE_EVAL_SOURCE,
      /Reflect\.get\([^,]+,\s*"(?:path|message|value)"\)/u,
    );
    assert.match(
      LIVE_EVAL_SOURCE,
      /validation_issue\.\$\{category\}=\$\{count\}/u,
    );
    assert.doesNotMatch(LIVE_EVAL_SOURCE, /judgment\.reasons/u);
    assert.doesNotMatch(
      LIVE_EVAL_SOURCE,
      /sanitizeReason|escapeRegExp/u,
    );
    assert.match(
      LIVE_EVAL_SOURCE,
      /failedCriteria\.map\(\s*\(criterion\)\s*=>\s*`judge criterion failed: \$\{criterion\}`/u,
    );
  });

  it("owns every exact strict-valid template in deterministic code", () => {
    assert.deepEqual(PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO, {
      email_worksheet: "Email worksheet",
      email_word_cards: "Email word cards",
      email_summary: "Email this summary",
      revise_material: "Revise this page",
      create_reading_game: "Make reading game",
      create_math_game: "Make math game",
      create_animal_game: "Make animal game",
      create_counting_game: "Make counting game",
      create_short_passage: "Make short passage",
      create_practice_page: "Make practice page",
      explain_next: "Explain next step",
      compare_options: "Compare options",
      show_next_skill: "Show next skill",
      email_hours: "Email hours summary",
      email_sources: "Email source summary",
      set_reminder: "Set Homa reminder",
      choose_activity: "Choose one activity",
    });
    for (const template of Object.values(
      PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO,
    )) {
      assert.equal(promptSuggestionListSchema.safeParse([template]).success, true);
    }
  });

  it("accepts exactly one known scenario and rejects unknown or authored text", () => {
    assert.equal(
      promptSuggestionScenarioOutputSchema.safeParse({
        scenario: "email_worksheet",
      }).success,
      true,
    );
    assert.equal(
      promptSuggestionScenarioOutputSchema.safeParse({
        scenario: "planner_write",
      }).success,
      false,
    );
    assert.equal(
      promptSuggestionScenarioOutputSchema.safeParse({
        scenario: "email_worksheet",
        label: "Model-authored text",
      }).success,
      false,
    );
  });

  it("maps every model scenario to its exact deterministic template", async () => {
    for (const scenario of PROMPT_SUGGESTION_SCENARIOS) {
      const result = await generatePromptSuggestionSet(
        { familyId: FAMILY_ID, request: REQUEST },
        async () => ({ scenario }),
      );

      assert.equal(result.assistantMessageId, REQUEST.assistantMessageId);
      assert.equal(
        result.assistantMessageFingerprint,
        createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
      );
      assert.equal(result.promptVersion, PROMPT_SUGGESTIONS_PROMPT_VERSION);
      assert.equal(result.source, "model");
      assert.deepEqual(result.suggestions, [
        PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO[scenario],
      ]);
      assert.equal(JSON.stringify(result).includes(scenario), false);
    }
  });

  it("falls back rather than persisting model-authored UI text", async () => {
    const output = {
      scenario: "email_worksheet",
      label: PRIVATE_CONVERSATION_TEXT,
    };
    const result = await generatePromptSuggestionSet(
      { familyId: FAMILY_ID, request: REQUEST },
      async () => output,
    );

    assert.equal(result.source, "fallback");
    assert.deepEqual(result.suggestions, [PROMPT_SUGGESTION_FALLBACK]);
    assert.equal(JSON.stringify(result).includes(PRIVATE_CONVERSATION_TEXT), false);
  });

  it("falls back when the scenario envelope is malformed", async () => {
    const invalidOutputs = [
      {},
      { scenario: "planner_write" },
      { scenario: ["email_worksheet"] },
      { scenarios: ["email_worksheet"] },
    ];

    for (const output of invalidOutputs) {
      const result = await generatePromptSuggestionSet(
        { familyId: FAMILY_ID, request: REQUEST },
        async () => output,
      );

      assert.equal(result.source, "fallback");
      assert.equal(
        result.assistantMessageFingerprint,
        createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
      );
      assert.deepEqual(result.suggestions, [PROMPT_SUGGESTION_FALLBACK]);
    }
  });

  it("uses the fallback without logging conversation text when production throws", async () => {
    const loggedArguments: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...argumentsToLog: unknown[]) => {
      loggedArguments.push(argumentsToLog);
    };

    try {
      const result = await generatePromptSuggestionSet(
        { familyId: FAMILY_ID, request: REQUEST },
        async () => {
          throw new Error(`Generation failed for ${PRIVATE_CONVERSATION_TEXT}`);
        },
      );

      assert.equal(result.source, "fallback");
      assert.equal(
        result.assistantMessageFingerprint,
        createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
      );
      assert.deepEqual(result.suggestions, [PROMPT_SUGGESTION_FALLBACK]);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(
      JSON.stringify(loggedArguments).includes(PRIVATE_CONVERSATION_TEXT),
      false,
    );
  });

  it("derives the route fallback fingerprint from the final assistant text", () => {
    assert.match(
      ROUTE_SOURCE,
      /createFallbackPromptSuggestionSet\(\s*parsed\.data\.assistantMessageId,\s*parsed\.data\.messages\.at\(-1\)\?\.text \?\? "",\s*\)/u,
    );
  });
});
