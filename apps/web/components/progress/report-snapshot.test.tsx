import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MapScores } from "@homa/core";

import { ReportSnapshot } from "../../app/onboarding/r/[token]/report-snapshot";
import type { TrajectoryEra } from "../../lib/map/trajectory-eras";

/** Hand-built scores: one subject that moved, so the chart draws a
 * two-point line whose connecting segment carries the era basis. */
function scoresWithMath(monthsAhead: number): MapScores {
  return {
    subjects: [
      {
        subjectId: "math",
        position: "ahead",
        monthsAhead,
        beyondScale: false,
        highConfidence: true,
        observations: 3,
        strongestObservedStatement: "Counts past 20 without getting stuck",
        frontierStatement: null,
        exposureBased: false,
      },
    ],
    strengthOrder: ["math"],
    mappedCount: 1,
    totalSubjects: 16,
    observationCount: 3,
  };
}

function eraPair(
  earlierBasis: string,
  laterBasis: string,
): TrajectoryEra[] {
  return [
    {
      generated_at: "2026-06-10T16:00:00.000Z",
      scores: scoresWithMath(24),
      renormalized: false,
      basisKey: earlierBasis,
    },
    {
      generated_at: "2026-07-11T16:00:00.000Z",
      scores: scoresWithMath(15),
      renormalized: false,
      basisKey: laterBasis,
    },
  ];
}

describe("ReportSnapshot scale boundaries", () => {
  it("dots the cross-scale stretch and says what the dots mean", () => {
    const html = renderToStaticMarkup(
      <ReportSnapshot
        childName="Story"
        generatedDate="July 11, 2026"
        plans={[]}
        eras={eraPair("2026.07.2|unknown|unknown", "current")}
      />,
    );

    assert.match(html, /stroke-dasharray="1 5"/);
    assert.match(html, /A dotted stretch means we improved how we measure/);
    assert.match(html, /Every number you see now is measured the new way\./);
    // The drop itself still renders: no red, no warning treatment, and
    // the down-segment is the dotted one, not a hidden one.
    assert.doesNotMatch(html, /behind/i);
  });

  it("stays quiet when every check-in shares one measuring stick", () => {
    const html = renderToStaticMarkup(
      <ReportSnapshot
        childName="Story"
        generatedDate="July 11, 2026"
        plans={[]}
        eras={eraPair("current", "current")}
      />,
    );

    assert.doesNotMatch(html, /stroke-dasharray="1 5"/);
    assert.doesNotMatch(html, /dotted stretch/);
  });
});
