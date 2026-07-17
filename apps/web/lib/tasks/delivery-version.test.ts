import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deliveryVersionForNewTaskRun,
  usesResearchBriefV2Delivery,
} from "./delivery-version";

describe("task-run delivery version", () => {
  it("pins v2 for a sandbox morning brief when only the sandbox rollout flag is exactly true", () => {
    assert.equal(
      deliveryVersionForNewTaskRun(
        "morning_brief",
        { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: "true" },
        true,
      ),
      "research_brief_v2",
    );
  });

  it("uses exact rollout flags only for new morning brief runs", () => {
    const cases: Array<{
      name: string;
      kind: "morning_brief" | "journal_prompt" | "custom";
      environment: Record<string, string | undefined>;
      familySandbox: boolean;
      expected: "legacy" | "research_brief_v2";
    }> = [
      {
        name: "global override enables every morning family",
        kind: "morning_brief",
        environment: { HOMA_RESEARCH_BRIEF_V2_ENABLED: "true" },
        familySandbox: false,
        expected: "research_brief_v2",
      },
      {
        name: "uppercase global flag remains disabled",
        kind: "morning_brief",
        environment: { HOMA_RESEARCH_BRIEF_V2_ENABLED: "TRUE" },
        familySandbox: true,
        expected: "legacy",
      },
      {
        name: "sandbox-only enables a sandbox family",
        kind: "morning_brief",
        environment: { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: "true" },
        familySandbox: true,
        expected: "research_brief_v2",
      },
      {
        name: "sandbox-only leaves a regular family legacy",
        kind: "morning_brief",
        environment: { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: "true" },
        familySandbox: false,
        expected: "legacy",
      },
      {
        name: "uppercase sandbox-only flag remains disabled",
        kind: "morning_brief",
        environment: { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: "TRUE" },
        familySandbox: true,
        expected: "legacy",
      },
      {
        name: "padded sandbox-only flag remains disabled",
        kind: "morning_brief",
        environment: { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: " true" },
        familySandbox: true,
        expected: "legacy",
      },
      {
        name: "custom tasks stay legacy during a global rollout",
        kind: "custom",
        environment: { HOMA_RESEARCH_BRIEF_V2_ENABLED: "true" },
        familySandbox: true,
        expected: "legacy",
      },
      {
        name: "journal prompts stay legacy during a sandbox rollout",
        kind: "journal_prompt",
        environment: { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: "true" },
        familySandbox: true,
        expected: "legacy",
      },
    ];

    for (const testCase of cases) {
      assert.equal(
        deliveryVersionForNewTaskRun(
          testCase.kind,
          testCase.environment,
          testCase.familySandbox,
        ),
        testCase.expected,
        testCase.name,
      );
    }
  });

  it("uses only the persisted version after run creation", () => {
    assert.equal(usesResearchBriefV2Delivery("research_brief_v2"), true);
    assert.equal(usesResearchBriefV2Delivery("legacy"), false);
  });
});
