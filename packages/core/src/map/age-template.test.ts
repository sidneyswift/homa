import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS, planQuestions } from "./bank";
import { buildMapQuestionQueue } from "./question-queue";
import {
  buildAgeTemplatePlan,
  buildMonthPlan,
  typicalAnswersForAge,
} from "./plans";
import type { MapAnswerInput } from "./scoring";

/**
 * The age template exists so a parent sees a real week about ninety
 * seconds into onboarding, from a name and a birthday, before she has
 * answered anything (founder ask, 2026-07-29).
 *
 * Its value rests on one measured claim: for a child typical for their
 * age, the template IS the plan her answers would have produced. These
 * tests hold that claim, so it cannot quietly stop being true when the
 * bank's typicalMonths move.
 */

const AGES = [36, 48, 60, 72, 84, 96, 108, 120, 132, 144];

/** Share of `actual` that also appears in `template`, as a percentage. */
function overlapPct(template: string[], actual: string[]): number {
  if (actual.length === 0) return 0;
  const inTemplate = new Set(template);
  return Math.round((100 * actual.filter((x) => inTemplate.has(x)).length) / actual.length);
}

function answersFor(ageMonths: number, count: number, answer: MapAnswerInput["answer"]) {
  const queue = buildMapQuestionQueue(planQuestions(ageMonths), {});
  return queue.slice(0, count).map((entry) => ({ itemId: entry.item.id, answer }));
}

describe("typicalAnswersForAge", () => {
  it("covers the whole bank, so no subject is silently missing from a template", () => {
    const answers = typicalAnswersForAge(90);
    const itemCount = MAP_SUBJECTS.reduce((n, s) => n + s.items.length, 0);
    assert.equal(answers.length, itemCount);
  });

  it("grades a skill by how far the child is past its typical age", () => {
    // One real item, checked at three ages around its own typicalMonths.
    const item = MAP_SUBJECTS.flatMap((s) => s.items).find((i) => i.typicalMonths >= 60)!;
    const at = (ageMonths: number) =>
      typicalAnswersForAge(ageMonths).find((a) => a.itemId === item.id)!.answer;

    assert.equal(at(item.typicalMonths - 1), "not_yet", "not reached yet");
    assert.equal(at(item.typicalMonths), "getting_there", "arriving about now");
    assert.equal(at(item.typicalMonths + 12), "easily", "a year past arrival");
  });
});

describe("buildAgeTemplatePlan", () => {
  it("produces a plan from age alone, which buildMonthPlan cannot do", () => {
    for (const ageMonths of AGES) {
      assert.equal(buildMonthPlan(ageMonths, [], {}), null, `age ${ageMonths}: no answers`);
      const template = buildAgeTemplatePlan(ageMonths, {});
      assert.ok(template, `age ${ageMonths}: template should exist`);
      assert.ok(template.weeks.length === 4, "four weeks");
      assert.ok(template.targets.length > 0, "at least one target");
      assert.ok(
        template.weeks.every((w) => w.activities.length > 0),
        "every week has activities",
      );
    }
  });

  it("weaves her child's interests in, the same as any other plan", () => {
    const withHorses = buildAgeTemplatePlan(90, { interests: ["horses"] });
    assert.ok(
      withHorses?.weeks.some((w) => w.activities.some((a) => a.includes("horses"))),
      "an interest should reach the activity text",
    );
  });

  it("matches the answered plan exactly for a child typical for their age", () => {
    // The claim the whole feature rests on. If this drops below 100 the
    // template has stopped being the plan and is only a guess at it.
    for (const ageMonths of AGES) {
      const template = buildAgeTemplatePlan(ageMonths, { interests: ["horses"] });
      const answered = buildMonthPlan(ageMonths, typicalAnswersForAge(ageMonths), {
        interests: ["horses"],
      });
      assert.ok(template && answered);
      assert.equal(
        overlapPct(template.targets, answered.targets),
        100,
        `age ${ageMonths}: targets`,
      );
      assert.equal(
        overlapPct(
          template.weeks.flatMap((w) => w.activities),
          answered.weeks.flatMap((w) => w.activities),
        ),
        100,
        `age ${ageMonths}: activities`,
      );
    }
  });

  it("still mostly matches when she has answered only a few questions", () => {
    // What she actually experiences: the board is up, she taps three
    // times, and it does not lurch. Measured at 8 of 10 ages exactly
    // right, so the floor here is deliberately below 100 and the point
    // is that it never collapses.
    const scores = AGES.map((ageMonths) => {
      const template = buildAgeTemplatePlan(ageMonths, { interests: ["horses"] });
      const partial = buildMonthPlan(ageMonths, answersFor(ageMonths, 3, "getting_there"), {
        interests: ["horses"],
      });
      if (!template || !partial) return 0;
      return overlapPct(
        template.weeks.flatMap((w) => w.activities),
        partial.weeks.flatMap((w) => w.activities),
      );
    });
    const exact = scores.filter((s) => s === 100).length;
    assert.ok(exact >= 7, `expected most ages to match exactly, got ${exact}/10: ${scores}`);
    assert.ok(
      scores.every((s) => s >= 60),
      `no age should collapse below 60% activity overlap: ${scores}`,
    );
  });

  it("is allowed to differ for a child well ahead of their age", () => {
    // Not a bug. A child answering "easily" everywhere genuinely needs a
    // different month, and the template correctly stops matching. Held
    // as a test so nobody later "fixes" the divergence away.
    const ahead = AGES.map((ageMonths) => {
      const template = buildAgeTemplatePlan(ageMonths, {});
      const actual = buildMonthPlan(ageMonths, answersFor(ageMonths, 16, "easily"), {});
      if (!template || !actual) return null;
      return overlapPct(template.targets, actual.targets);
    }).filter((x): x is number => x !== null);
    assert.ok(
      ahead.some((pct) => pct < 100),
      "a well-ahead child should get different targets at some age",
    );
  });

  it("covers every age the questions cover, so no child sees an empty week", () => {
    for (let ageMonths = 24; ageMonths <= 168; ageMonths += 1) {
      assert.ok(
        buildAgeTemplatePlan(ageMonths, {}),
        `age ${ageMonths} months produced no template`,
      );
    }
  });
});
