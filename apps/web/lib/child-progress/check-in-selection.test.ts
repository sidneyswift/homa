import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMapQuestionQueue,
  getMapSubject,
  isMapChecklistComplete,
  planQuestions,
  type MapAnswer,
  type MapItem,
  type MapQuestionPlan,
} from "@homa/core";

import {
  buildQueue,
  isChecklistComplete,
} from "../../app/onboarding/question-queue";
import {
  AGENT_CHECK_IN_EXCLUDED_ITEM_IDS,
  selectNextProgressItem,
} from "./check-in-selection";
import type { ProgressSelectionAnswer } from "./types";

const BASE_ITEM: MapItem = {
  id: "test.base",
  statement: "Base question",
  typicalMonths: 60,
  sources: [],
};
const FIRST_LADDER_ITEM: MapItem = {
  id: "test.first-ladder",
  statement: "First ladder question",
  typicalMonths: 66,
  sources: [],
};
const SECOND_LADDER_ITEM: MapItem = {
  id: "test.second-ladder",
  statement: "Second ladder question",
  typicalMonths: 72,
  sources: [],
};
const QUESTION_PLANS: MapQuestionPlan[] = [
  {
    subjectId: "test",
    base: BASE_ITEM,
    ladders: [FIRST_LADDER_ITEM, SECOND_LADDER_ITEM],
  },
];
const CLIMB_STOPPING_ANSWERS: readonly MapAnswer[] = [
  "getting_there",
  "not_yet",
  "not_sure",
  "skip",
];

function getAgePlanBaseItem(ageMonths: number, subjectId: string): MapItem {
  const plan = planQuestions(ageMonths).find(
    (candidate) => candidate.subjectId === subjectId,
  );
  assert.ok(plan);
  return plan.base;
}

function getFirstSubjectItemIds(
  subjectId: string,
  count: number,
): string[] {
  const subject = getMapSubject(subjectId);
  assert.ok(subject);
  return subject.items.slice(0, count).map((item) => item.id);
}

function answer(
  itemId: string,
  value: MapAnswer,
  answeredAt: string,
  selectionId = `${itemId}:${answeredAt}:${value}`,
): ProgressSelectionAnswer {
  const evidenceId =
    value === "easily" ||
    value === "getting_there" ||
    value === "not_yet"
      ? selectionId
      : null;
  return {
    selectionId,
    evidenceId,
    itemId,
    answer: value,
    answeredAt,
  };
}

describe("shared map question queue", () => {
  it("accepts readonly plans and answer records", () => {
    const plans: readonly MapQuestionPlan[] = QUESTION_PLANS;
    const answers: Readonly<Record<string, MapAnswer>> = {};

    assert.equal(buildMapQuestionQueue(plans, answers)[0]?.item.id, BASE_ITEM.id);
  });

  it("serves an unanswered base item", () => {
    assert.deepEqual(buildMapQuestionQueue(QUESTION_PLANS, {}), [
      {
        subjectId: "test",
        item: BASE_ITEM,
        isLadder: false,
      },
    ]);
  });

  it("unlocks exactly the next ladder item after easily", () => {
    assert.deepEqual(
      buildMapQuestionQueue(QUESTION_PLANS, {
        [BASE_ITEM.id]: "easily",
      }),
      [
        {
          subjectId: "test",
          item: FIRST_LADDER_ITEM,
          isLadder: true,
        },
      ],
    );
  });

  it("ends the climb after every answer other than easily", () => {
    for (const answer of CLIMB_STOPPING_ANSWERS) {
      assert.deepEqual(
        buildMapQuestionQueue(QUESTION_PLANS, {
          [BASE_ITEM.id]: answer,
        }),
        [],
      );
      assert.deepEqual(
        buildMapQuestionQueue(QUESTION_PLANS, {
          [BASE_ITEM.id]: "easily",
          [FIRST_LADDER_ITEM.id]: answer,
        }),
        [],
      );
    }
  });

  it("does not complete a checklist that has not started", () => {
    assert.equal(
      isMapChecklistComplete({
        ageMonths: 84,
        answers: {},
        answered: 0,
      }),
      false,
    );
  });

  it("completes a checklist whose bases all end the climb", () => {
    const ageMonths = 84;
    const plans = planQuestions(ageMonths);
    const answers: Record<string, MapAnswer> = {};
    for (const plan of plans) {
      answers[plan.base.id] = "not_yet";
    }

    assert.equal(
      isMapChecklistComplete({
        ageMonths,
        answers,
        answered: plans.length,
      }),
      true,
    );
  });

  it("keeps the onboarding exports as direct compatibility aliases", () => {
    assert.equal(buildQueue, buildMapQuestionQueue);
    assert.equal(isChecklistComplete, isMapChecklistComplete);
  });
});

describe("agent check-in item selection", () => {
  it("uses the full age plan when subject scope is omitted", () => {
    const ageMonths = 72;
    const expectedPlan = planQuestions(ageMonths).find(
      (plan) => plan.subjectId === "literacy",
    );
    assert.ok(expectedPlan);
    const answers = planQuestions(ageMonths)
      .filter((plan) => plan.subjectId !== expectedPlan.subjectId)
      .map((plan) =>
        answer(
          plan.base.id,
          "not_yet",
          "2026-07-01T10:00:00.000Z",
        ),
      );

    const result = selectNextProgressItem({
      ageMonths,
      answers,
    });

    assert.equal(result?.id, expectedPlan.base.id);
  });

  it("selects an unanswered age-plan base item", () => {
    const result = selectNextProgressItem({
      ageMonths: 72,
      subjectIds: ["literacy"],
      answers: [],
    });

    assert.equal(
      result?.id,
      getAgePlanBaseItem(72, "literacy").id,
    );
  });

  it("prioritizes a subject with fewer than two real observations", () => {
    const [firstArtItem, secondArtItem] = getFirstSubjectItemIds("art", 2);
    const [firstMathItem, secondMathItem] = getFirstSubjectItemIds("math", 2);

    const result = selectNextProgressItem({
      ageMonths: 84,
      subjectIds: ["art", "math"],
      answers: [
        answer(firstArtItem, "easily", "2026-07-01T10:00:00.000Z"),
        answer(secondArtItem, "not_yet", "2026-07-02T10:00:00.000Z"),
        answer(firstMathItem, "not_sure", "2026-07-01T10:00:00.000Z"),
        answer(secondMathItem, "skip", "2026-07-02T10:00:00.000Z"),
      ],
    });

    assert.equal(result?.id, getAgePlanBaseItem(84, "math").id);
  });

  it("uses an unanswered eligible item before refreshing an answered item", () => {
    const artBase = getAgePlanBaseItem(84, "art");
    const musicBase = getAgePlanBaseItem(84, "music");

    const result = selectNextProgressItem({
      ageMonths: 84,
      subjectIds: ["art", "music"],
      answers: [
        answer(artBase.id, "not_yet", "2026-06-01T10:00:00.000Z"),
      ],
    });

    assert.equal(result?.id, musicBase.id);
  });

  it("refreshes the eligible item with the oldest evidence", () => {
    const artBase = getAgePlanBaseItem(84, "art");
    const musicBase = getAgePlanBaseItem(84, "music");

    const result = selectNextProgressItem({
      ageMonths: 84,
      subjectIds: ["art", "music"],
      answers: [
        answer(artBase.id, "not_yet", "2026-07-01T10:00:00.000Z"),
        answer(musicBase.id, "not_yet", "2026-06-01T10:00:00.000Z"),
      ],
    });

    assert.equal(result?.id, musicBase.id);
  });

  it("orders refresh evidence by instant across timestamp offsets", () => {
    const artBase = getAgePlanBaseItem(84, "art");
    const musicBase = getAgePlanBaseItem(84, "music");

    const result = selectNextProgressItem({
      ageMonths: 84,
      subjectIds: ["art", "music"],
      answers: [
        answer(
          artBase.id,
          "not_yet",
          "2026-07-01T10:00:00+02:00",
        ),
        answer(
          musicBase.id,
          "not_yet",
          "2026-07-01T09:00:00+00:00",
        ),
      ],
    });

    assert.equal(result?.id, artBase.id);
  });

  it("ranks refreshes by the eligible item's evidence date", () => {
    const artPlan = planQuestions(84).find(
      (candidate) => candidate.subjectId === "art",
    );
    assert.ok(artPlan);
    const artLadder = artPlan.ladders[0];
    assert.ok(artLadder);
    const musicBase = getAgePlanBaseItem(84, "music");
    const olderMusicItem = getMapSubject("music")?.items.find(
      (item) => item.id !== musicBase.id,
    );
    assert.ok(olderMusicItem);

    const result = selectNextProgressItem({
      ageMonths: 84,
      subjectIds: ["art", "music"],
      answers: [
        answer(artPlan.base.id, "easily", "2026-05-01T10:00:00.000Z"),
        answer(artLadder.id, "not_yet", "2026-07-01T10:00:00.000Z"),
        answer(olderMusicItem.id, "easily", "2026-04-01T10:00:00.000Z"),
        answer(musicBase.id, "not_yet", "2026-06-01T10:00:00.000Z"),
      ],
    });

    assert.equal(result?.id, artPlan.base.id);
  });

  it("orders offset timestamps by their actual instant", () => {
    const literacyPlan = planQuestions(72).find(
      (plan) => plan.subjectId === "literacy",
    );
    assert.ok(literacyPlan);
    const firstLadderItem = literacyPlan.ladders.find(
      (item) => !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id),
    );
    assert.ok(firstLadderItem);

    const result = selectNextProgressItem({
      ageMonths: 72,
      subjectIds: ["literacy"],
      answers: [
        answer(
          literacyPlan.base.id,
          "not_yet",
          "2026-07-01T10:00:00+02:00",
          "evidence-older",
        ),
        answer(
          literacyPlan.base.id,
          "easily",
          "2026-07-01T09:30:00+00:00",
          "evidence-newer",
        ),
      ],
    });

    assert.equal(result?.id, firstLadderItem.id);
  });

  it("uses selection ID to order responses at the same instant", () => {
    const literacyPlan = planQuestions(72).find(
      (plan) => plan.subjectId === "literacy",
    );
    assert.ok(literacyPlan);
    const firstLadderItem = literacyPlan.ladders.find(
      (item) => !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id),
    );
    assert.ok(firstLadderItem);

    const result = selectNextProgressItem({
      ageMonths: 72,
      subjectIds: ["literacy"],
      answers: [
        answer(
          literacyPlan.base.id,
          "skip",
          "2026-07-01T08:00:00Z",
          "evidence-2",
        ),
        answer(
          literacyPlan.base.id,
          "easily",
          "2026-07-01T10:00:00+02:00",
          "evidence_1",
        ),
      ],
    });

    assert.equal(result?.id, firstLadderItem.id);
  });

  it("orders responses by full Postgres microsecond precision", () => {
    const literacyPlan = planQuestions(72).find(
      (plan) => plan.subjectId === "literacy",
    );
    assert.ok(literacyPlan);
    const firstLadderItem = literacyPlan.ladders.find(
      (item) => !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id),
    );
    assert.ok(firstLadderItem);

    const result = selectNextProgressItem({
      ageMonths: 72,
      subjectIds: ["literacy"],
      answers: [
        answer(
          literacyPlan.base.id,
          "not_yet",
          "2026-07-01T08:00:00.000001Z",
          "z-older",
        ),
        answer(
          literacyPlan.base.id,
          "easily",
          "2026-07-01T08:00:00.000002Z",
          "a-newer",
        ),
      ],
    });

    assert.equal(result?.id, firstLadderItem.id);
  });

  it("rejects an invalid evidence timestamp clearly", () => {
    const literacyBase = getAgePlanBaseItem(84, "literacy");

    assert.throws(
      () =>
        selectNextProgressItem({
          ageMonths: 84,
          subjectIds: ["literacy"],
          answers: [
            answer(
              literacyBase.id,
              "easily",
              "not-a-timestamp",
              "evidence-invalid",
            ),
          ],
        }),
      {
        name: "TypeError",
        message:
          'Invalid answeredAt "not-a-timestamp" for selection "evidence-invalid"',
      },
    );
  });

  it("uses the stable item ID when ranking signals tie", () => {
    const artBase = getAgePlanBaseItem(84, "art");
    const musicBase = getAgePlanBaseItem(84, "music");
    const answeredAt = "2026-06-01T10:00:00.000Z";

    const result = selectNextProgressItem({
      ageMonths: 84,
      subjectIds: ["music", "art"],
      answers: [
        answer(musicBase.id, "not_yet", answeredAt),
        answer(artBase.id, "not_yet", answeredAt),
      ],
    });

    assert.equal(
      result?.id,
      [artBase.id, musicBase.id].sort()[0],
    );
  });

  it("skips bundled items while continuing the age-plan ladder", () => {
    const mathBase = getAgePlanBaseItem(92, "math");
    const result = selectNextProgressItem({
      ageMonths: 92,
      subjectIds: ["math"],
      answers: [
        answer(mathBase.id, "easily", "2026-07-01T10:00:00.000Z"),
      ],
    });

    assert.equal(
      AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has("math.skip-counting"),
      true,
    );
    assert.equal(
      AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(
        "literacy.chapter-books",
      ),
      true,
    );
    assert.equal(
      AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(
        "literacy.reads-short-book",
      ),
      true,
    );
    assert.equal(result?.id, "math.times-tables");
  });

  it("falls back below an excluded age-plan base before climbing", () => {
    const initial = selectNextProgressItem({
      ageMonths: 96,
      subjectIds: ["math"],
      answers: [],
    });
    assert.equal(initial?.id, "math.derived-facts");

    const afterFallback = selectNextProgressItem({
      ageMonths: 96,
      subjectIds: ["math"],
      answers: [
        answer(
          "math.derived-facts",
          "easily",
          "2026-07-01T10:00:00.000Z",
        ),
      ],
    });
    assert.equal(afterFallback?.id, "math.times-tables");
  });

  it("does not refresh an answered item after a response exhausts scope", () => {
    const artBase = getAgePlanBaseItem(84, "art");

    assert.equal(
      selectNextProgressItem({
        ageMonths: 84,
        subjectIds: ["art"],
        answers: [
          answer(
            artBase.id,
            "not_yet",
            "2026-07-11T18:00:00.000000Z",
          ),
        ],
        allowRefresh: false,
      }),
      null,
    );
  });

  it("returns null when the requested subject scope is empty", () => {
    assert.equal(
      selectNextProgressItem({
        ageMonths: 84,
        subjectIds: [],
        answers: [],
      }),
      null,
    );
  });
});
