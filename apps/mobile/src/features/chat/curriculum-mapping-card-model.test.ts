import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCurriculumMappingCardPart } from "./curriculum-mapping-card-model";

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
        declaredUnitCount: 1,
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

describe("parseCurriculumMappingCardPart", () => {
  it("preserves exact unit and Planner provenance", () => {
    assert.deepEqual(parseCurriculumMappingCardPart(part()), {
      draftId: DRAFT_ID,
      revision: 2,
      sourceTitle: "Nature curriculum",
      decompositionQuality: "full",
      unitKind: "week",
      declaredUnitCount: 1,
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
    });
  });

  it("rejects a malformed unit instead of showing a partial review", () => {
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
