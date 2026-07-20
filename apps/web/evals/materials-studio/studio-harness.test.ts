import assert from "node:assert/strict";
import { test } from "node:test";

import { gradeStudioTrace } from "./studio-harness";
import type { StudioEvalScenario, StudioEvalTrace } from "./studio-harness";

/**
 * Pure-logic coverage for the deterministic grader (no model, runs in CI-
 * speed). The model-driven harness and judge need the AI Gateway and run
 * out of band; this locks the grading contract so a green trace grades
 * green and a broken one names exactly what failed.
 */

const scenario: StudioEvalScenario = {
  id: "t",
  request: "make an activity pack, he loves space",
  child: { name: "Leo", ageYears: 5, mapEvidence: ["counts to 15"], interests: ["space"] },
  expect: {
    readsFiles: ["references/recipes/activity-pack.md"],
    anchorId: "activity-pack",
    themeIncludes: ["space"],
    themeExcludes: ["bug"],
    maxBuilds: 2,
  },
};

function trace(over: Partial<StudioEvalTrace> = {}): StudioEvalTrace {
  return {
    scenarioId: "t",
    text: "Here is Leo's space activity pack.",
    calls: [],
    filesRead: ["references/recipes/activity-pack.md"],
    anchorsUsed: ["activity-pack"],
    imagePrompts: ["a friendly space activity pack, rockets and planets, no text"],
    builtHtml: ["<h1>Space Activity Pack</h1>"],
    buildCount: 1,
    ...over,
  };
}

test("a correct run grades all-green", () => {
  const checks = gradeStudioTrace(scenario, trace());
  const failed = checks.filter((c) => !c.pass);
  assert.equal(failed.length, 0, `unexpected failures: ${failed.map((c) => c.name).join(", ")}`);
  assert.ok(checks.length >= 5, "grades every expectation");
});

test("a run that never read the recipe fails that check by name", () => {
  const checks = gradeStudioTrace(scenario, trace({ filesRead: [] }));
  const read = checks.find((c) => c.name.includes("activity-pack.md"));
  assert.ok(read && !read.pass, "the missing recipe read is flagged");
});

test("the wrong anchor fails the anchor check", () => {
  const checks = gradeStudioTrace(scenario, trace({ anchorsUsed: ["foldable"] }));
  const anchor = checks.find((c) => c.name.includes("rides anchor"));
  assert.ok(anchor && !anchor.pass);
});

test("a leaked excluded theme fails", () => {
  const checks = gradeStudioTrace(
    scenario,
    trace({ builtHtml: ["<h1>Bug Explorer Pack</h1>"], imagePrompts: ["a bug explorer pack"] }),
  );
  const space = checks.find((c) => c.name.includes('includes "space"'));
  const bug = checks.find((c) => c.name.includes('avoids "bug"'));
  assert.ok(space && !space.pass, "missing required theme flagged");
  assert.ok(bug && !bug.pass, "leaked excluded theme flagged");
});

test("ask-first is satisfied only by a question with no build", () => {
  const askScenario: StudioEvalScenario = {
    ...scenario,
    expect: { asksInsteadOfBuilding: true },
  };
  const asked = gradeStudioTrace(
    askScenario,
    trace({ buildCount: 0, text: "About how high does Theo count these days?", builtHtml: [] }),
  );
  assert.ok(asked.every((c) => c.pass), "a question with no build passes");
  const built = gradeStudioTrace(askScenario, trace({ buildCount: 1 }));
  assert.ok(built.some((c) => !c.pass), "building instead of asking fails");
});

test("thrash: too many builds fails the build check", () => {
  const checks = gradeStudioTrace(scenario, trace({ buildCount: 3 }));
  const build = checks.find((c) => c.name.includes("without thrash"));
  assert.ok(build && !build.pass);
});
