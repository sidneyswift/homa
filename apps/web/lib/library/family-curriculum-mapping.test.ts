import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  curriculumMappingPreviewFromDraft,
  curriculumPlannerSourceTitle,
  curriculumUnitUrl,
  invalidCurriculumEvidenceOrdinals,
  parseApprovedCurriculumPlannerTargets,
  proposedCurriculumMappingSchema,
  restoreCurriculumMappingDraft,
  reviseCurriculumMappingDraft,
  signCurriculumMappingDraft,
  verifyCurriculumMappingDraft,
  type CurriculumMappingDraftPayload,
} from "./family-curriculum-mapping";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const DRAFT_ID = "55555555-5555-4555-8555-555555555555";
const SECRET = "curriculum-test-secret";
const SESSION_ID = "session-1";

const PROPOSAL = {
  sourceAssetId: ASSET_ID,
  decompositionQuality: "full" as const,
  unitKind: "week" as const,
  declaredUnitCount: 1,
  notes: null,
  units: [
    {
      ordinal: 1,
      unitLabel: "Week 1",
      sourceLocator: "Page 8",
      evidenceQuote: "Week 1: Living things",
      confidence: "high" as const,
      subjectIds: ["science"],
      topics: [{ name: "living things", quote: "Living things" }],
      summary: "Observe what living things need.",
    },
  ],
  placements: [
    {
      unitOrdinal: 1,
      childId: CHILD_ID,
      subjectId: "science",
      week: 1,
      activityText: "Read Week 1 and complete the living-things observation.",
    },
  ],
};

function payload(): CurriculumMappingDraftPayload {
  return {
    v: 1,
    draftId: DRAFT_ID,
    familyId: FAMILY_ID,
    createdAt: "2026-08-02T10:00:00.000Z",
    source: {
      assetId: ASSET_ID,
      title: "Nature curriculum",
      updatedAt: "2026-08-02T09:00:00.000Z",
    },
    eligibleChildIds: [CHILD_ID],
    childNames: { [CHILD_ID]: "Maya" },
    planBaseVersions: [
      {
        childId: CHILD_ID,
        subjectId: "science",
        updatedAt: "2026-08-02T09:30:00.000Z",
      },
    ],
    history: [
      {
        revision: 1,
        proposal: PROPOSAL,
        action: "created",
        restoredFrom: null,
      },
    ],
  };
}

describe("family curriculum mapping contract", () => {
  it("requires honest full counts and ordered unique units", () => {
    assert.equal(proposedCurriculumMappingSchema.safeParse(PROPOSAL).success, true);
    assert.equal(
      proposedCurriculumMappingSchema.safeParse({
        ...PROPOSAL,
        declaredUnitCount: 2,
      }).success,
      false,
    );
    assert.equal(
      proposedCurriculumMappingSchema.safeParse({
        ...PROPOSAL,
        units: [
          { ...PROPOSAL.units[0], ordinal: 2 },
          { ...PROPOSAL.units[0], ordinal: 1 },
        ],
        declaredUnitCount: 2,
      }).success,
      false,
    );
  });

  it("binds a draft to one family, session, signature, and day", () => {
    const token = signCurriculumMappingDraft(payload(), SESSION_ID, SECRET);
    assert.ok(
      verifyCurriculumMappingDraft(token, SESSION_ID, FAMILY_ID, {
        secret: SECRET,
        now: new Date("2026-08-02T12:00:00.000Z"),
      }),
    );
    assert.equal(
      verifyCurriculumMappingDraft(token, "other-session", FAMILY_ID, {
        secret: SECRET,
        now: new Date("2026-08-02T12:00:00.000Z"),
      }),
      null,
    );
    assert.equal(
      verifyCurriculumMappingDraft(token, SESSION_ID, OTHER_FAMILY_ID, {
        secret: SECRET,
        now: new Date("2026-08-02T12:00:00.000Z"),
      }),
      null,
    );
    assert.equal(
      verifyCurriculumMappingDraft(`${token}x`, SESSION_ID, FAMILY_ID, {
        secret: SECRET,
        now: new Date("2026-08-02T12:00:00.000Z"),
      }),
      null,
    );
    assert.equal(
      verifyCurriculumMappingDraft(token, SESSION_ID, FAMILY_ID, {
        secret: SECRET,
        now: new Date("2026-08-03T10:00:01.000Z"),
      }),
      null,
    );
  });

  it("returns parent-readable labels without changing ids", () => {
    const preview = curriculumMappingPreviewFromDraft(payload());
    assert.equal(preview.sourceTitle, "Nature curriculum");
    assert.equal(preview.units[0].subjectNames[0], "Science");
    assert.equal(preview.placements[0].childName, "Maya");
    assert.equal(preview.placements[0].unitLabel, "Week 1");
  });

  it("rejects a real quote when the model assigns it to the wrong page", () => {
    const document = {
      ok: true as const,
      segmentKind: "page" as const,
      segments: [
        { ordinal: 7, locator: "Page 7", text: "Week 1: Living things" },
        { ordinal: 8, locator: "Page 8", text: "A different lesson" },
      ],
      totalSegments: 8,
      truncated: false,
    };
    assert.deepEqual(
      invalidCurriculumEvidenceOrdinals(PROPOSAL, document),
      [1],
    );
    assert.deepEqual(
      invalidCurriculumEvidenceOrdinals(
        {
          ...PROPOSAL,
          units: [
            {
              ...PROPOSAL.units[0],
              sourceLocator: "Page 7",
            },
          ],
        },
        document,
      ),
      [],
    );
  });

  it("accepts canonical partial-page quotes but rejects text labeled unreadable", () => {
    for (const state of ["readable", "partial", "unreadable", "blank"] as const) {
      assert.deepEqual(invalidCurriculumEvidenceOrdinals(PROPOSAL, {
        ok: true, segmentKind: "page", totalSegments: 8, truncated: true,
        segments: [{ ordinal: 8, locator: "Page 8", text: "Week 1: Living things", state, method: "vision" }],
      }), state === "readable" || state === "partial" ? [] : [1]);
    }
  });

  it("uses a distinct Blob URL identity while preserving the original path", () => {
    const source =
      "https://store.public.blob.vercel-storage.com/families/family/library/book.pdf";
    const unit = curriculumUnitUrl(source, DRAFT_ID, 8);
    assert.equal(new URL(unit).pathname, new URL(source).pathname);
    assert.match(new URL(unit).hash, /homa-unit-.*-8/u);
    const longSource = `https://store.public.blob.vercel-storage.com/${"a".repeat(1_930)}`;
    assert.equal(curriculumUnitUrl(longSource, DRAFT_ID, 5_000).length <= 2_100, true);
  });

  it("keeps the original and unit names inside the Planner title limit", () => {
    assert.equal(
      curriculumPlannerSourceTitle("Nature curriculum", "Week 1"),
      "Nature curriculum · Week 1",
    );
    const bounded = curriculumPlannerSourceTitle("A".repeat(180), "Week 12");
    assert.equal(bounded.length <= 180, true);
    assert.match(bounded, /Week 12$/u);
  });

  it("reads an idempotent receipt from the approval ledger", () => {
    const placement = curriculumMappingPreviewFromDraft(payload()).placements[0];
    assert.deepEqual(parseApprovedCurriculumPlannerTargets([placement]), [placement]);
    assert.deepEqual(
      parseApprovedCurriculumPlannerTargets([{ ...placement, week: 9 }]),
      [],
    );
  });

  it("stops revisions and restores before producing an invalid 101st token", async () => {
    const full = payload();
    full.createdAt = new Date().toISOString();
    full.history = Array.from({ length: 100 }, (_, index) => ({
      revision: index + 1,
      proposal: PROPOSAL,
      action: "revised" as const,
      restoredFrom: null,
    }));
    const token = signCurriculumMappingDraft(full, SESSION_ID, SECRET);
    const revised = await reviseCurriculumMappingDraft({
      familyId: FAMILY_ID,
      sessionId: SESSION_ID,
      secret: SECRET,
      draftToken: token,
      proposal: PROPOSAL,
    });
    assert.equal(revised.ok, false);
    if (!revised.ok) assert.equal(revised.failure.code, "revision_limit");

    const restored = restoreCurriculumMappingDraft({
      familyId: FAMILY_ID,
      sessionId: SESSION_ID,
      secret: SECRET,
      draftToken: token,
      restoreRevision: 1,
    });
    assert.equal(restored.ok, false);
    if (!restored.ok) assert.equal(restored.failure.code, "revision_limit");
  });
});
