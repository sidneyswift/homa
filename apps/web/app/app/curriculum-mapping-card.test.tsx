import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CurriculumMappingCard,
  parseCurriculumMappingCardPart,
} from "./curriculum-mapping-card";

const DRAFT_ID = "50000000-0000-4000-8000-000000000001";

function part(overrides: Record<string, unknown> = {}) {
  return {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "preview_curriculum_mapping",
    output: {
      previewed: true,
      preview: {
        draftId: DRAFT_ID,
        revision: 2,
        sourceTitle: "Nature curriculum",
        decompositionQuality: "full",
        unitKind: "week",
        declaredUnitCount: 2,
        notes: null,
        restoredFrom: null,
        units: [
          {
            ordinal: 1,
            unitLabel: "Week 1",
            sourceLocator: "Page 8",
            confidence: "high",
            subjectNames: ["Science"],
            summary: "Observe what living things need.",
          },
          {
            ordinal: 2,
            unitLabel: "Week 2",
            sourceLocator: "Page 12",
            confidence: "medium",
            subjectNames: ["Science", "Language arts"],
            summary: "Record changes in one growing plant.",
          },
        ],
        placements: [
          {
            unitOrdinal: 1,
            unitLabel: "Week 1",
            childName: "Maya",
            subjectName: "Science",
            week: 1,
            activityText: "Read Week 1 and complete the observation.",
          },
        ],
        ...overrides,
      },
    },
  };
}

describe("CurriculumMappingCard", () => {
  it("shows every proposed unit, exact locator, and Planner target", () => {
    const card = parseCurriculumMappingCardPart(part());
    assert.ok(card);
    const html = renderToStaticMarkup(<CurriculumMappingCard card={card} />);
    for (const expected of [
      "Review before saving",
      "Nature curriculum",
      "Week 1",
      "Page 8",
      "Week 2",
      "Page 12",
      "1 Planner addition",
      "Maya · Science · Week 1 in Planner",
      "From Nature curriculum · Week 1 · Page 8",
      "This review has not changed Library or Planner",
      "Save these units and Planner additions.",
    ]) {
      assert.match(html, new RegExp(expected.replaceAll(".", "\\."), "u"));
    }
  });

  it("names a restored version and a Library-only approval", () => {
    const card = parseCurriculumMappingCardPart(
      part({ restoredFrom: 1, placements: [] }),
    );
    assert.ok(card);
    const html = renderToStaticMarkup(<CurriculumMappingCard card={card} />);
    assert.match(html, /Restored version 1/u);
    assert.match(html, /Planner additions/u);
    assert.match(html, /Planner unchanged/u);
    assert.match(html, /Save these units\./u);
  });

  it("shows an honest partial-read note", () => {
    const card = parseCurriculumMappingCardPart(
      part({
        decompositionQuality: "partial",
        declaredUnitCount: 12,
        notes: "Pages 20 through 24 were unreadable.",
      }),
    );
    assert.ok(card);
    const html = renderToStaticMarkup(<CurriculumMappingCard card={card} />);
    assert.match(html, /2 of 12 weeks found/u);
    assert.match(html, /Homa couldn&#x27;t read the whole file:/u);
    assert.match(html, /Pages 20 through 24 were unreadable/u);
  });

  it("rejects malformed, foreign, and partially parsed output", () => {
    assert.equal(
      parseCurriculumMappingCardPart({ ...part(), toolName: "other_tool" }),
      null,
    );
    assert.equal(parseCurriculumMappingCardPart(part({ draftId: "not-an-id" })), null);
    assert.equal(
      parseCurriculumMappingCardPart(
        part({
          units: [
            {
              ordinal: 1,
              unitLabel: "Week 1",
              sourceLocator: "Page 8",
              confidence: "certain",
              subjectNames: ["Science"],
              summary: "Observe what living things need.",
            },
          ],
        }),
      ),
      null,
    );
  });
});
