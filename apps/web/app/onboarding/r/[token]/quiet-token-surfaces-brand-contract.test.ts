import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const SOURCES = [
  ["plan", read("./plan/[subjectId]/page.tsx")],
  ["plan weeks", read("./plan/[subjectId]/plan-weeks.tsx")],
  ["lesson layout", read("./lesson/[subjectId]/lesson-layout.tsx")],
  ["lesson view", read("./lesson/[subjectId]/lesson-view.tsx")],
  ["lesson keep", read("./lesson/[subjectId]/lesson-keep-button.tsx")],
  ["lesson retry", read("./lesson/[subjectId]/lesson-retry-button.tsx")],
  ["material card", read("../../../app/material-card.tsx")],
] as const;
const PRIMITIVES = read("../../../../components/design/quiet-primitives.css");

describe("Quiet tokenized plan and lesson contract", () => {
  it("keeps linked family journeys free of retired presentation authorities", () => {
    for (const [name, source] of SOURCES) {
      assert.doesNotMatch(
        source,
        /font-mono|font-serif|font-hand|rounded-(?:pill|md|lg|xl|2xl|3xl|full)|(?:bg-card|bg-page|border-border(?:-subtle)?|text-(?:body|strong|muted|subtle|brand))/u,
        `${name} contains a retired presentation utility`,
      );
    }
  });

  it("makes the plan and lesson state boundaries reviewable", () => {
    for (const hook of [
      "quiet-plan__frame",
      "quiet-plan__weeks",
      "quiet-plan__retest",
      "quiet-lesson__frame",
      "quiet-lesson__statement",
      "quiet-lesson__steps",
      "quiet-artifact-card--material",
    ]) {
      assert.match(PRIMITIVES, new RegExp(`\\.${hook}\\b`, "u"), `missing ${hook}`);
    }
  });

  it("preserves the high-risk side effects behind the new surfaces", () => {
    const plan = SOURCES.find(([name]) => name === "plan")?.[1] ?? "";
    const lessonView = SOURCES.find(([name]) => name === "lesson view")?.[1] ?? "";
    const lessonKeep = SOURCES.find(([name]) => name === "lesson keep")?.[1] ?? "";
    const lessonRetry = SOURCES.find(([name]) => name === "lesson retry")?.[1] ?? "";
    assert.match(plan, /getOrBuildPlan|runPlanNarrative|planExists/u);
    assert.match(lessonView, /SubjectLessonStatusPoll|SubjectLessonKeepButton/u);
    assert.match(lessonKeep, /\/api\/map\/subject-lesson\/keep/u);
    assert.match(lessonRetry, /\/api\/map\/subject-lesson\/retry/u);
  });
});
