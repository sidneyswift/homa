import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  createResearchBriefPreparationService,
  knowledgeRowMatchesPreparationSnapshot,
  prepareResearchBrief,
  type PrepareResearchBriefInput,
  type ResearchBriefPreparationRecord,
  type ResearchBriefPreparationScope,
  type ResearchBriefReservationKnowledgeRow,
} from "./research-brief-preparation";
import type { TaskDeliveryVersion } from "./delivery-version";

const DRAFT = `Last night I researched keeping sounds together while reading

What I learned: Reading Rockets says a stretchy sound stays on into the next sound, so the word reaches the ear as one piece. In mat, mmm runs into a before the quick t closes mat.

Why it's interesting: Story said "ship" sounds choppy in Bob Books. Story can try "sh" running into "i" before the quick "p" closes "ship".

Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?`;

function retryableValidation(errors: string[]) {
  return {
    ok: false as const,
    retryable: true,
    category: "validation" as const,
    errors,
  };
}

function terminalFailure(category: string, errors: string[]) {
  return {
    ok: false as const,
    retryable: false,
    category,
    errors,
  };
}

function scope(overrides: Partial<ResearchBriefPreparationScope> = {}): ResearchBriefPreparationScope {
  return {
    taskKind: "morning_brief",
    taskStatus: "running",
    child: {
      id: "child-1",
      name: "Story",
      stage: "early_elem",
      subjectKeys: ["phonics"],
      frontierDomains: [],
      currentWorkFacts: [],
      frontierFacts: [],
      candidates: [],
    },
    siblingNames: ["Mae"],
    observationIds: ["observation-1"],
    sourceId: "knowledge-1",
    sourceSnapshot: {
      kind: "knowledge_cited",
      id: "knowledge-1",
      title: "Connected phonation",
      sourceNames: ["Reading Rockets"],
      citationUrls: ["https://www.readingrockets.org/phonation"],
      topic: "phonics",
      claims: ["A stretchy sound stays on into the next sound."],
      topicType: "subject",
      lens: "current_study",
      stage: "early_elem",
      confidence: "high",
      sourceTier: 1,
    },
    ...overrides,
  };
}

function preparationService(
  selectedScope: ResearchBriefPreparationScope | null = scope(),
  options: {
    deliveryVersion?: TaskDeliveryVersion;
    persistenceResult?:
      | { prepared: true }
      | {
          prepared: false;
          reason:
            | "already_delivered"
            | "inactive_run"
            | "knowledge_row_changed"
            | "knowledge_row_recently_used"
            | "source_reserved";
        };
  } = {},
): {
  records: ResearchBriefPreparationRecord[];
  prepare(
    input: Omit<PrepareResearchBriefInput, "deliveryVersion">,
  ): ReturnType<ReturnType<typeof createResearchBriefPreparationService>>;
} {
  const records: ResearchBriefPreparationRecord[] = [];
  const persistenceResult = options.persistenceResult ?? { prepared: true };
  const prepare = createResearchBriefPreparationService({
    loadScope: async () => selectedScope,
    upsert: async (record) => {
      if (persistenceResult.prepared) {
        const index = records.findIndex((stored) => stored.taskRunId === record.taskRunId);
        if (index >= 0) records[index] = record;
        else records.push(record);
      }
      return persistenceResult;
    },
  });
  return {
    records,
    prepare: async (input) =>
      await prepare({
        ...input,
        deliveryVersion:
          options.deliveryVersion ?? "research_brief_v2",
      }),
  };
}

describe("research brief preparation", () => {
  it("exports the preparation service", () => {
    assert.equal(typeof prepareResearchBrief, "function");
  });

  it("stores the exact valid draft, hash, and selected source snapshot", async () => {
    const service = preparationService();
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      observationId: "observation-1",
      draft: DRAFT,
    });
    assert.deepEqual(result, { ok: true, draft: DRAFT });
    assert.deepEqual(service.records, [{
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      observationId: "observation-1",
      draft: DRAFT,
      draftHash: createHash("sha256").update(DRAFT).digest("hex"),
      sourceSnapshot: scope().sourceSnapshot,
    }]);
  });

  it("rejects same-morning tense for every v2 preparation", async () => {
    const service = preparationService();
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT.replace("Last night", "This morning"),
    });

    assert.deepEqual(result, retryableValidation(["headline tense"]));
    assert.equal(service.records.length, 0);
  });

  it("requires the locked knowledge row to remain active, fresh, eligible, and snapshot-identical", () => {
    const sourceSnapshot = scope().sourceSnapshot;
    const currentRow: ResearchBriefReservationKnowledgeRow = {
      id: "knowledge-1",
      status: "active",
      supersededBy: null,
      title: sourceSnapshot.title,
      topicType: sourceSnapshot.topicType,
      topicKey: sourceSnapshot.topic,
      lens: sourceSnapshot.lens,
      stage: sourceSnapshot.stage,
      confidence: sourceSnapshot.confidence,
      sourceTier: sourceSnapshot.sourceTier,
      citations: [{
        url: sourceSnapshot.citationUrls[0],
        claim: sourceSnapshot.claims[0],
        sourceName: sourceSnapshot.sourceNames[0],
      }],
      lastVerifiedAt: "2026-07-16T12:00:00.000Z",
      freshnessTtlDays: 14,
    };
    const now = new Date("2026-07-16T13:00:00.000Z");

    assert.equal(
      knowledgeRowMatchesPreparationSnapshot(currentRow, sourceSnapshot, now),
      true,
    );
    const changedRows: ResearchBriefReservationKnowledgeRow[] = [
      { ...currentRow, status: "superseded" },
      { ...currentRow, supersededBy: "knowledge-2" },
      { ...currentRow, confidence: "low" },
      { ...currentRow, sourceTier: 4 },
      { ...currentRow, stage: "high" },
      { ...currentRow, topicKey: "unrelated-topic" },
      { ...currentRow, title: "Replacement research" },
      {
        ...currentRow,
        citations: [{
          ...currentRow.citations[0],
          sourceName: "Unrelated Institute",
        }],
      },
      {
        ...currentRow,
        lastVerifiedAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    for (const changed of changedRows) {
      assert.equal(
        knowledgeRowMatchesPreparationSnapshot(changed, sourceSnapshot, now),
        false,
      );
    }
  });

  it("writes nothing for a run pinned to legacy after the flag turns on", async () => {
    const service = preparationService(scope(), {
      deliveryVersion: "legacy",
    });
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("disabled", [
        "morning research brief v2 is not enabled",
      ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("returns source and child revision errors without writing a draft", async () => {
    const service = preparationService();
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT
        .replace("Reading Rockets", "A source")
        .replace("Story said", "The child said")
        .replace("Story can try", "The child can try"),
    });
    assert.deepEqual(result, retryableValidation([
        "selected source name must appear in What I learned",
        "selected child name must appear in Why it's interesting",
      ]));
    assert.equal(service.records.length, 0);
  });

  it("does not accept child or source names embedded in longer words", async () => {
    const service = preparationService(scope({
      child: { ...scope().child, name: "Ana" },
      sourceSnapshot: {
        ...scope().sourceSnapshot,
        sourceNames: ["ERIC"],
      },
    }));
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT
        .replace("Reading Rockets", "ERICson")
        .replace("Story is", "Anabel is"),
    });
    assert.deepEqual(result, retryableValidation([
        "selected source name must appear in What I learned",
        "selected child name must appear in Why it's interesting",
      ]));
    assert.equal(service.records.length, 0);
  });

  it("matches canonical Unicode, apostrophe, and hyphen variants", async () => {
    const service = preparationService(scope({
      child: { ...scope().child, name: "Mae-José" },
      siblingNames: [],
      sourceSnapshot: {
        ...scope().sourceSnapshot,
        sourceNames: ["O'Connor Éducation"],
      },
    }));
    const draft = DRAFT
      .replace("Reading Rockets", "O’Connor E\u0301ducation")
      .replace("Story said", "Mae‑Jose\u0301 said")
      .replace("Story can try", "Mae‑Jose\u0301 can try");
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft,
      }),
      { ok: true, draft },
    );
    assert.equal(service.records.length, 1);
  });

  it("rejects a nonselected sibling name using Unicode whole-phrase matching", async () => {
    const service = preparationService(scope({
      siblingNames: ["Mae-José"],
    }));
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT.replace(
        'Story can try "sh" running into "i" before the quick "p" closes "ship".',
        "Mae‑Jose\u0301 reads different books.",
      ),
    });
    assert.deepEqual(
      result,
      retryableValidation([
        "nonselected child name must not appear in research brief",
      ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("rejects a sibling name in What I learned", async () => {
    const service = preparationService();
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT.replace(
        "In mat, mmm runs into a",
        "In mat, Mae runs mmm into a",
      ),
    });
    assert.deepEqual(
      result,
      retryableValidation([
        "nonselected child name must not appear in research brief",
      ]),
    );
  });

  it("rejects a sibling name in the CTA and requires the selected child", async () => {
    const service = preparationService();
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT.replace(
        "Want me to make Story",
        "Want me to make Mae",
      ),
    });
    assert.deepEqual(
      result,
      retryableValidation([
        "nonselected child name must not appear in research brief",
        "CTA child name must be the selected child",
      ]),
    );
  });

  it("does not reject a sibling name embedded in a longer word", async () => {
    const service = preparationService(scope({
      siblingNames: ["Ana"],
    }));
    const draft = DRAFT.replace(
      'Story can try "sh" running into "i" before the quick "p" closes "ship".',
      "The banana card changes how you model the same words.",
    );
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft,
      }),
      { ok: true, draft },
    );
  });

  it("rejects a noneligible source before persistence", async () => {
    const service = preparationService(scope({ sourceId: "knowledge-2" }));
    const result = await service.prepare({
      familyId: "family-1",
      taskRunId: "run-1",
      knowledgeId: "knowledge-1",
      childId: "child-1",
      draft: DRAFT,
    });
    assert.deepEqual(
      result,
      terminalFailure("ineligible_source", [
        "selected knowledge source is not eligible for this child",
      ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("treats an unavailable scope and stale observation as terminal", async () => {
    const unavailable = preparationService(null);
    assert.deepEqual(
      await unavailable.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("scope_unavailable", [
        "task, child, or source is not available for this family",
      ]),
    );

    const staleObservation = preparationService();
    assert.deepEqual(
      await staleObservation.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        observationId: "observation-stale",
        draft: DRAFT,
      }),
      terminalFailure("stale_observation", [
        "observation is not available for this child",
      ]),
    );
  });

  it("replaces a valid preparation for the same task run idempotently", async () => {
    const service = preparationService();
    const revisedDraft = DRAFT.replace("Bob Books", "Frog and Toad");
    for (const draft of [DRAFT, revisedDraft]) {
      assert.deepEqual(
        await service.prepare({
          familyId: "family-1",
          taskRunId: "run-1",
          knowledgeId: "knowledge-1",
          childId: "child-1",
          draft,
        }),
        { ok: true, draft },
      );
    }
    assert.equal(service.records.length, 1);
    assert.equal(service.records[0]?.draft, revisedDraft);
  });

  it("refuses every non-morning task run", async () => {
    const service = preparationService(scope({ taskKind: "custom" }));
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("inactive_run", [
        "task run is not an active morning brief",
      ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("refuses finished and otherwise inactive task runs", async () => {
    for (const taskStatus of ["done", "failed"]) {
      const service = preparationService(scope({ taskStatus }));
      assert.deepEqual(
        await service.prepare({
          familyId: "family-1",
          taskRunId: "run-1",
          knowledgeId: "knowledge-1",
          childId: "child-1",
          draft: DRAFT,
        }),
        terminalFailure("inactive_run", [
          "task run is not an active morning brief",
        ]),
      );
      assert.equal(service.records.length, 0);
    }
  });

  it("rejects a run that finishes after bounded context was loaded", async () => {
    const service = preparationService(scope(), {
      persistenceResult: {
        prepared: false,
        reason: "inactive_run",
      },
    });
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("inactive_run", [
        "task run is not an active morning brief",
      ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("reports a delivered preparation instead of claiming an update", async () => {
    const service = preparationService(scope(), {
      persistenceResult: {
        prepared: false,
        reason: "already_delivered",
      },
    });
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("already_delivered", [
        "research brief preparation was already delivered",
      ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("rejects a knowledge row used after bounded context was loaded", async () => {
    const service = preparationService(scope(), {
      persistenceResult: {
        prepared: false,
        reason: "knowledge_row_recently_used",
      },
    });
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("knowledge_row_recently_used", [
          "selected knowledge row was delivered within the last 14 days",
        ]),
    );
    assert.equal(service.records.length, 0);
  });

  it("rejects a source reserved after bounded context was loaded", async () => {
    const service = preparationService(scope(), {
      persistenceResult: {
        prepared: false,
        reason: "source_reserved",
      },
    });
    assert.deepEqual(
      await service.prepare({
        familyId: "family-1",
        taskRunId: "run-1",
        knowledgeId: "knowledge-1",
        childId: "child-1",
        draft: DRAFT,
      }),
      terminalFailure("source_reserved", [
          "selected knowledge source is already reserved by another morning brief",
        ]),
    );
    assert.equal(service.records.length, 0);
  });
});
