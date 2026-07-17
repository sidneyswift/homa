import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV,
  writePromptSuggestionEvalDebugArtifact,
  type PromptSuggestionEvalDebugArtifact,
} from "./prompt-suggestions-eval-debug";

const REPO_ROOT = "/repo";
const DIAGNOSTIC_PATH =
  "/repo/.context/compound-engineering/ce-optimize/prompt-suggestions/iteration-5-diagnostics.json";
const ROOT_GITIGNORE_SOURCE = readFileSync(
  new URL("../.gitignore", import.meta.url),
  "utf8",
);

function createSafeDebugArtifact(): PromptSuggestionEvalDebugArtifact {
  return {
    version: 2,
    fixtureCount: 1,
    fixtures: [
      {
        fixtureId: "worksheet-created",
        suggestions: ["Email worksheet"],
        scenarioId: "email_worksheet",
        source: "model",
        failureCodes: ["suggestion.forbidden_claim_pattern"],
        sanitizedReasons: [
          "Fixed diagnostic: suggestion.forbidden_claim_pattern",
        ],
        judgments: [
          {
            suggestionIndex: 0,
            relevance: true,
            grounding: false,
            currentCapability: true,
            specificity: true,
            nonRedundancy: true,
            voice: true,
            superiorToGenericFallback: true,
            failureCodes: ["criterion.grounding"],
            sanitizedReasons: [
              "Fixed diagnostic: criterion.grounding",
            ],
          },
        ],
      },
    ],
  };
}

describe("prompt suggestion eval debug artifact", () => {
  it("writes nothing when the opt-in environment variable is absent", () => {
    let writes = 0;
    const status = writePromptSuggestionEvalDebugArtifact(
      {
        environment: {},
        repoRoot: REPO_ROOT,
        fakeCorpusValidated: true,
        artifact: createSafeDebugArtifact(),
      },
      () => {
        writes += 1;
      },
    );

    assert.equal(status, "disabled");
    assert.equal(writes, 0);
  });

  it("writes the private JSON artifact after explicit opt-in", () => {
    let writtenPath = "";
    let writtenJson = "";
    const status = writePromptSuggestionEvalDebugArtifact(
      {
        environment: {
          [PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV]: DIAGNOSTIC_PATH,
        },
        repoRoot: REPO_ROOT,
        fakeCorpusValidated: true,
        artifact: createSafeDebugArtifact(),
      },
      (targetPath, json) => {
        writtenPath = targetPath;
        writtenJson = json;
      },
    );

    const parsed = JSON.parse(writtenJson) as {
      version: number;
      fixtures: Array<{
        scenarioId?: string | null;
        sanitizedReasons?: string[];
      }>;
    };
    assert.equal(status, "written");
    assert.equal(writtenPath, DIAGNOSTIC_PATH);
    assert.equal(parsed.version, 2);
    assert.equal(parsed.fixtures[0]?.scenarioId, "email_worksheet");
    assert.deepEqual(parsed.fixtures[0]?.sanitizedReasons, [
      "Fixed diagnostic: suggestion.forbidden_claim_pattern",
    ]);
  });

  it("refuses a write until fixture validation proves the corpus is fake", () => {
    let writes = 0;
    const status = writePromptSuggestionEvalDebugArtifact(
      {
        environment: {
          [PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV]: DIAGNOSTIC_PATH,
        },
        repoRoot: REPO_ROOT,
        fakeCorpusValidated: false,
        artifact: createSafeDebugArtifact(),
      },
      () => {
        writes += 1;
      },
    );

    assert.equal(status, "fake_corpus_required");
    assert.equal(writes, 0);
  });

  it("allows only the dedicated ignored diagnostic filename pattern", () => {
    let writes = 0;
    const status = writePromptSuggestionEvalDebugArtifact(
      {
        environment: {
          [PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV]:
            "/repo/.context/compound-engineering/ce-optimize/prompt-suggestions/debug.json",
        },
        repoRoot: REPO_ROOT,
        fakeCorpusValidated: true,
        artifact: createSafeDebugArtifact(),
      },
      () => {
        writes += 1;
      },
    );

    assert.equal(status, "invalid_path");
    assert.equal(writes, 0);
    assert.match(
      ROOT_GITIGNORE_SOURCE,
      /^\.context\/compound-engineering\/ce-optimize\/prompt-suggestions\/iteration-\*-diagnostics\.json$/mu,
    );
  });

  it("serializes only fixed codes and fixed sanitized reasons", () => {
    const safeArtifact = createSafeDebugArtifact();
    const artifactWithPrivateFields = {
      ...safeArtifact,
      prompt: "private-prompt",
      realPath: "/private/real/path",
      fixtures: [
        {
          ...safeArtifact.fixtures[0],
          familyContext: "private-family",
          transcript: "private-transcript",
          scenarioId: "private-scenario",
          rawError: "private-error",
          providerBody: "private-provider-body",
          credentials: "private-credentials",
          failureCodes: [
            "suggestion.forbidden_claim_pattern",
            "fixture.private-code",
          ],
          sanitizedReasons: [
            "Fixed diagnostic: suggestion.forbidden_claim_pattern",
            "Fixed diagnostic: criterion.grounding private-family",
          ],
          judgments: [
            {
              ...safeArtifact.fixtures[0]?.judgments[0],
              failureCodes: [
                "criterion.grounding",
                "criterion.private-code",
              ],
              rawReasons: ["private-raw-reason"],
              sanitizedReasons: [
                "Fixed diagnostic: criterion.grounding",
                "Fixed diagnostic: criterion.grounding private-family",
              ],
            },
          ],
        },
      ],
    } as unknown as PromptSuggestionEvalDebugArtifact;
    let writtenJson = "";

    writePromptSuggestionEvalDebugArtifact(
      {
        environment: {
          [PROMPT_SUGGESTIONS_EVAL_DEBUG_FILE_ENV]: DIAGNOSTIC_PATH,
        },
        repoRoot: REPO_ROOT,
        fakeCorpusValidated: true,
        artifact: artifactWithPrivateFields,
      },
      (_targetPath, json) => {
        writtenJson = json;
      },
    );

    const parsed = JSON.parse(writtenJson) as {
      fixtures: Array<{
        scenarioId: string | null;
        failureCodes: string[];
        sanitizedReasons: string[];
        judgments: Array<{
          failureCodes: string[];
          sanitizedReasons: string[];
        }>;
      }>;
    };
    assert.equal(parsed.fixtures[0]?.scenarioId, null);
    assert.deepEqual(parsed.fixtures[0]?.failureCodes, [
      "suggestion.forbidden_claim_pattern",
    ]);
    assert.deepEqual(parsed.fixtures[0]?.sanitizedReasons, [
      "Fixed diagnostic: suggestion.forbidden_claim_pattern",
    ]);
    assert.deepEqual(parsed.fixtures[0]?.judgments[0]?.failureCodes, [
      "criterion.grounding",
    ]);
    assert.deepEqual(parsed.fixtures[0]?.judgments[0]?.sanitizedReasons, [
      "Fixed diagnostic: criterion.grounding",
    ]);

    for (const excludedValue of [
      "private-prompt",
      "/private/real/path",
      "private-family",
      "private-transcript",
      "private-scenario",
      "private-error",
      "private-provider-body",
      "private-credentials",
      "private-code",
      "private-raw-reason",
    ]) {
      assert.equal(writtenJson.includes(excludedValue), false);
    }
  });
});
