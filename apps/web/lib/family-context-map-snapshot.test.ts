import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreMap } from "@homa/core";

import { ageInMonths } from "./child-age";
import {
  renderFamilyContext,
  type ChildAnswerRow,
  type FamilyContextRows,
} from "./family-context";
import {
  chartMonthsForScore,
  displayMonths,
} from "./map/trajectory-format";

/**
 * Chart-to-agent parity guard (2026-07-13 incident): the Progress
 * trajectory chart showed a parent "-9 mo" in self-care and the agent,
 * whose map snapshot carried only the word "growing", disclaimed the
 * family's own data. This suite recomputes, from the same scorer and the
 * same shared value law the chart uses, every figure the chart would
 * plot, and requires each one to appear verbatim in the rendered agent
 * context. If either surface changes its number without the other, this
 * fails.
 */

/** First-of-month birth date exactly `months` before now, so the age the
 * renderer computes stays stable for the whole calendar day. */
function birthMonthsAgo(months: number): string {
  const now = new Date();
  const total =
    now.getUTCFullYear() * 12 + now.getUTCMonth() - months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Every "chart reads" fragment the snapshot must contain for one child,
 * derived from the scorer plus the chart's own value law and formatter. */
function expectedChartFragments(
  birthMonth: string,
  answers: ChildAnswerRow[],
): string[] {
  const scores = scoreMap(
    ageInMonths(birthMonth, new Date()),
    answers.map((row) => ({
      itemId: row.question_id,
      answer: row.answer,
    })),
  );
  const fragments: string[] = [];
  for (const score of scores.subjects) {
    if (score.exposureBased) continue;
    const plotted = chartMonthsForScore(score);
    if (plotted === null) continue;
    fragments.push(
      `chart reads ${displayMonths(plotted, score.beyondScale)} mo`,
    );
  }
  return fragments;
}

// Real bank items, pinned by anchor so the shapes stay readable:
// math.counts-to-10 anchors at 42 months, math.counts-past-20 at 54.
const AHEAD_CHILD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROWING_CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// 48 months keeps the ahead figure under the age-scaled cap, so it
// renders as a plain "+6" rather than a capped "13+" floor.
const aheadBirth = birthMonthsAgo(48);
const growingBirth = birthMonthsAgo(60);

// A 48-month-old counting past 20 easily reads ahead (positive figure);
// a 60-month-old getting there on counts-to-10 with a not-yet above it
// reads growing with a REAL negative frontier distance, the exact shape
// from the incident.
const aheadAnswers: ChildAnswerRow[] = [
  {
    child_id: AHEAD_CHILD_ID,
    question_id: "math.counts-past-20",
    answer: "easily",
  },
];
const growingAnswers: ChildAnswerRow[] = [
  {
    child_id: GROWING_CHILD_ID,
    question_id: "math.counts-to-10",
    answer: "getting_there",
  },
  {
    child_id: GROWING_CHILD_ID,
    question_id: "math.counts-past-20",
    answer: "not_yet",
  },
];

const rows: FamilyContextRows = {
  family: {
    name: "Parity family",
    us_state: "FL",
    parent_display_name: "Elena",
    time_zone: "America/New_York",
  },
  children: [
    {
      id: AHEAD_CHILD_ID,
      name: "Nora",
      birth_month: aheadBirth,
      profile: {},
    },
    {
      id: GROWING_CHILD_ID,
      name: "Theo",
      birth_month: growingBirth,
      profile: {},
    },
  ],
  memories: [],
  answers: [...aheadAnswers, ...growingAnswers],
  members: [{ display_name: "Elena" }],
};

function renderedMapSnapshot(): string {
  const rendered = renderFamilyContext(rows);
  const parsed = JSON.parse(
    rendered.slice(rendered.indexOf("{")),
  ) as { mapSnapshot: string };
  return parsed.mapSnapshot;
}

describe("agent map snapshot carries the chart's own figures", () => {
  it("contains, verbatim, every figure the trajectory chart would plot", () => {
    const snapshot = renderedMapSnapshot();
    const expected = [
      ...expectedChartFragments(aheadBirth, aheadAnswers),
      ...expectedChartFragments(growingBirth, growingAnswers),
    ];

    // Vacuity guards: the fixture must actually exercise a positive
    // figure and a below-age negative figure, or the parity claim is
    // hollow. If a bank change breaks these, rebuild the fixture.
    assert.ok(
      expected.some((fragment) =>
        /chart reads (\+\d+|\d+\+) mo/u.test(fragment),
      ),
      `fixture lost its ahead figure: ${JSON.stringify(expected)}`,
    );
    assert.ok(
      expected.some((fragment) => fragment.includes("chart reads -")),
      `fixture lost its below-age figure: ${JSON.stringify(expected)}`,
    );

    for (const fragment of expected) {
      assert.ok(
        snapshot.includes(fragment),
        `agent snapshot is missing the chart's figure "${fragment}"\n${snapshot}`,
      );
    }
  });

  it("keeps the below-age figure on the growing subject's own line", () => {
    const snapshot = renderedMapSnapshot();
    const theoSection = snapshot.slice(snapshot.indexOf("Theo:"));
    assert.match(theoSection, /Math: growing · chart reads -\d+ mo/u);
  });

  it("renders reading guidance before the per-child data so truncation can never cut the law", () => {
    const snapshot = renderedMapSnapshot();
    const guidanceIndex = snapshot.indexOf(
      '"chart reads" is the exact figure',
    );
    const dataIndex = snapshot.indexOf("Nora:");
    assert.ok(guidanceIndex >= 0, "guidance sentence missing");
    assert.ok(dataIndex >= 0, "child sections missing");
    assert.ok(guidanceIndex < dataIndex);
    assert.ok(
      snapshot.includes(
        "Never tell her you cannot see her child's progress data.",
      ),
    );
  });
});
