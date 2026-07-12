import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ageInMonths,
  getMapItem,
  scoreMap,
} from "@homa/core";
import {
  getProgressTaxonomyDomain,
  getProgressTaxonomyTopic,
} from "@homa/taxonomy/progress";

import { buildChildProgressView } from "./projection";
import type {
  OpenProgressConflict,
  ProgressEvidence,
  ProgressSelectionAnswer,
  ResolvedProgressConflict,
} from "./types";

const CHILD = {
  id: "child-1",
  name: "Maya",
  birthDate: "2019-07-01",
};
const FAMILY_ID = "family-1";
const NOW = new Date("2026-07-11T18:00:00.000Z");
const TAXONOMY_ONLY_ITEM_ID = "math.comparing-groups-more-or-fewer";

function evidence(
  overrides: Partial<ProgressEvidence> = {},
): ProgressEvidence {
  return {
    id: "evidence-default",
    childId: CHILD.id,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    answer: "easily",
    source: "check_in",
    memberUserId: "member-1",
    adultDisplayName: "Elena",
    quote: null,
    channel: "web",
    messageId: "message-1",
    checkInId: "check-in-1",
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-07-11T16:00:00.000Z",
    createdAt: "2026-07-11T16:00:01.000Z",
    ...overrides,
  };
}

function openConflict(
  overrides: Partial<OpenProgressConflict> = {},
): OpenProgressConflict {
  return {
    id: "conflict-open",
    childId: CHILD.id,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    evidenceIdA: "evidence-a",
    evidenceIdB: "evidence-b",
    state: "open",
    resolvedAnswer: null,
    resolvedEvidenceId: null,
    observedAt: "2026-07-11T16:05:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function resolvedConflict(
  overrides: Partial<ResolvedProgressConflict> = {},
): ResolvedProgressConflict {
  return {
    id: "conflict-resolved",
    childId: CHILD.id,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    evidenceIdA: "evidence-a",
    evidenceIdB: "evidence-b",
    state: "resolved",
    resolvedAnswer: "easily",
    resolvedEvidenceId: "evidence-a",
    observedAt: "2026-07-11T16:05:00.000Z",
    resolvedAt: "2026-07-11T16:10:00.000Z",
    ...overrides,
  };
}

function build(input: {
  child?: typeof CHILD;
  familyId?: string;
  timeZone?: string;
  evidence?: readonly ProgressEvidence[];
  conflicts?: readonly (OpenProgressConflict | ResolvedProgressConflict)[];
  selectionAnswers?: readonly ProgressSelectionAnswer[];
  now?: Date;
}) {
  return buildChildProgressView({
    child: input.child ?? CHILD,
    familyId: input.familyId ?? FAMILY_ID,
    timeZone: input.timeZone ?? "America/Chicago",
    evidence: input.evidence ?? [],
    conflicts: input.conflicts ?? [],
    selectionAnswers: input.selectionAnswers ?? [],
    now: input.now ?? NOW,
  });
}

function findTopic(
  view: ReturnType<typeof buildChildProgressView>,
  itemId: string,
) {
  for (const subject of view.subjects) {
    for (const domain of subject.domains) {
      const topic = domain.topics.find((candidate) => candidate.itemId === itemId);
      if (topic !== undefined) return topic;
    }
  }
  return undefined;
}

function projectedTimeZone(
  view: ReturnType<typeof buildChildProgressView>,
): unknown {
  return (view as unknown as { timeZone?: unknown }).timeZone;
}

function projectedSubjectSummary(
  view: ReturnType<typeof buildChildProgressView>,
  subjectId: string,
): unknown {
  const subject = view.subjects.find(
    (candidate) => candidate.subjectId === subjectId,
  );
  return (
    subject as unknown as { summary?: unknown } | undefined
  )?.summary;
}

describe("child progress projection", () => {
  it("retains the family time zone and latest safe source summary", () => {
    const view = build({
      timeZone: "America/Los_Angeles",
      evidence: [
        evidence({
          id: "older-checklist",
          itemId: "math.counts-to-5",
          source: "checklist",
          checkInId: null,
          observedAt: "2026-07-11T20:00:00.000000Z",
        }),
        evidence({
          id: "latest-journal",
          itemId: "math.small-groups",
          source: "journal",
          checkInId: null,
          observedAt: "2026-07-12T00:30:00.000000Z",
        }),
      ],
    });

    assert.equal(projectedTimeZone(view), "America/Los_Angeles");
    assert.deepEqual(projectedSubjectSummary(view, "math"), {
      kind: "evidence",
      observedAt: "2026-07-12T00:30:00.000000Z",
      source: {
        kind: "journal",
        adultDisplayName: "Elena",
        checkInId: null,
      },
    });
  });

  it("groups bank evidence under its curated taxonomy domain and map subject", () => {
    const bankEntry = getMapItem("math.counts-to-5");
    const taxonomyDomain = getProgressTaxonomyDomain(
      "counting-cardinality",
    );
    assert.ok(bankEntry);
    assert.ok(taxonomyDomain);

    const view = build({ evidence: [evidence()] });
    const math = view.subjects.find((subject) => subject.subjectId === "math");
    const counting = math?.domains.find(
      (domain) => domain.domainId === "counting-cardinality",
    );

    assert.equal(math?.displayName, bankEntry.subject.displayName);
    assert.equal(counting?.displayName, taxonomyDomain.displayName);
    assert.equal(counting?.topics[0]?.statement, bankEntry.item.statement);
  });

  it("renders a taxonomy-only topic without changing map scores", () => {
    const taxonomyTopic = getProgressTaxonomyTopic(
      TAXONOMY_ONLY_ITEM_ID,
    );
    assert.ok(taxonomyTopic);
    assert.equal(getMapItem(TAXONOMY_ONLY_ITEM_ID), undefined);

    const view = build({
      evidence: [
        evidence({
          id: "taxonomy-evidence",
          itemId: TAXONOMY_ONLY_ITEM_ID,
          answer: "getting_there",
        }),
      ],
    });

    assert.deepEqual(
      view.scores,
      scoreMap(ageInMonths(CHILD.birthDate, NOW), []),
    );
    assert.equal(
      findTopic(view, TAXONOMY_ONLY_ITEM_ID)?.statement,
      taxonomyTopic.name,
    );
  });

  it("rejects taxonomy-only topics from content domains", () => {
    assert.throws(
      () =>
        build({
          evidence: [
            evidence({
              id: "content-topic-evidence",
              itemId: "science.dinosaur-sizes",
            }),
          ],
        }),
      {
        name: "TypeError",
        message: 'Unknown progress item "science.dinosaur-sizes"',
      },
    );
  });

  it("matches scoreMap for the effective anchored evidence", () => {
    const anchoredEvidence = [
      evidence({
        id: "math-evidence",
        itemId: "math.counts-to-5",
        answer: "easily",
      }),
      evidence({
        id: "literacy-evidence",
        itemId: "literacy.book-handling",
        answer: "getting_there",
      }),
    ];

    const view = build({ evidence: anchoredEvidence });
    const expected = scoreMap(ageInMonths(CHILD.birthDate, NOW), [
      { itemId: "math.counts-to-5", answer: "easily" },
      { itemId: "literacy.book-handling", answer: "getting_there" },
    ]);

    assert.deepEqual(view.scores, expected);
  });

  it("renders both adult entries for an open conflict and omits its score", () => {
    const evidenceA = evidence({
      id: "evidence-a",
      answer: "easily",
      adultDisplayName: "Elena",
      memberUserId: "member-a",
      source: "journal",
      quote: "Maya counted each shell once.",
      checkInId: null,
      observedAt: "2026-07-11T15:00:00.000Z",
    });
    const evidenceB = evidence({
      id: "evidence-b",
      answer: "not_yet",
      adultDisplayName: "Jordan",
      memberUserId: "member-b",
      source: "report_probe",
      quote: "She skipped the fourth block today.",
      checkInId: "check-in-jordan",
      observedAt: "2026-07-11T16:00:00.000Z",
    });

    const view = build({
      evidence: [evidenceA, evidenceB],
      conflicts: [openConflict()],
    });

    assert.equal(findTopic(view, "math.counts-to-5")?.state, "conflict");
    assert.equal(findTopic(view, "math.counts-to-5")?.answer, null);
    assert.equal(findTopic(view, "math.counts-to-5")?.source, null);
    assert.equal(view.scores.observationCount, 0);
    assert.deepEqual(view.conflicts[0]?.adultAnswers, [
      {
        evidenceId: "evidence-a",
        adultDisplayName: "Elena",
        answer: "easily",
        observedAt: "2026-07-11T15:00:00.000Z",
        source: {
          kind: "journal",
          adultDisplayName: "Elena",
          checkInId: null,
        },
      },
      {
        evidenceId: "evidence-b",
        adultDisplayName: "Jordan",
        answer: "not_yet",
        observedAt: "2026-07-11T16:00:00.000Z",
        source: {
          kind: "report_probe",
          adultDisplayName: "Jordan",
          checkInId: "check-in-jordan",
        },
      },
    ]);
    assert.equal(
      JSON.stringify(view).includes("Maya counted each shell once."),
      false,
    );
    assert.equal(
      JSON.stringify(view).includes(
        "She skipped the fourth block today.",
      ),
      false,
    );
    assert.equal(view.subjects[0]?.state, "conflict");
    assert.equal(view.subjects[0]?.evidenceCount, 2);
    assert.deepEqual(projectedSubjectSummary(view, "math"), {
      kind: "conflict",
      observedAt: "2026-07-11T16:00:00.000Z",
      adultDisplayNames: ["Elena", "Jordan"],
    });
  });

  it("uses resolved conflict evidence in the topic and score", () => {
    const evidenceA = evidence({
      id: "evidence-a",
      answer: "easily",
      observedAt: "2026-07-09T15:00:00.000Z",
    });
    const evidenceB = evidence({
      id: "evidence-b",
      answer: "not_yet",
      observedAt: "2026-07-10T15:00:00.000Z",
    });
    const newerEvidence = evidence({
      id: "evidence-newer",
      answer: "getting_there",
      observedAt: "2026-07-11T15:00:00.000Z",
    });

    const view = build({
      evidence: [evidenceA, evidenceB, newerEvidence],
      conflicts: [resolvedConflict()],
    });

    assert.equal(findTopic(view, "math.counts-to-5")?.answer, "easily");
    assert.deepEqual(
      view.scores,
      scoreMap(ageInMonths(CHILD.birthDate, NOW), [
        { itemId: "math.counts-to-5", answer: "easily" },
      ]),
    );
    assert.deepEqual(view.conflicts, []);
  });

  it("falls back when a resolved conflict points to superseded evidence", () => {
    const resolvedEvidence = evidence({
      id: "evidence-a",
      answer: "easily",
      supersededAt: "2026-07-10T16:00:00.000Z",
      observedAt: "2026-07-09T15:00:00.000Z",
    });
    const otherConflictEvidence = evidence({
      id: "evidence-b",
      answer: "not_yet",
      observedAt: "2026-07-10T15:00:00.000Z",
    });
    const latestActiveEvidence = evidence({
      id: "evidence-active",
      answer: "getting_there",
      source: "conversation",
      quote: "Maya counted carefully and paused once.",
      observedAt: "2026-07-11T15:00:00.000Z",
    });

    const view = build({
      evidence: [
        resolvedEvidence,
        otherConflictEvidence,
        latestActiveEvidence,
      ],
      conflicts: [resolvedConflict()],
    });

    assert.equal(
      findTopic(view, "math.counts-to-5")?.answer,
      "getting_there",
    );
    assert.deepEqual(
      view.scores,
      scoreMap(ageInMonths(CHILD.birthDate, NOW), [
        {
          itemId: "math.counts-to-5",
          answer: "getting_there",
        },
      ]),
    );
    assert.equal(
      findTopic(view, "math.counts-to-5")?.source?.kind,
      "conversation",
    );
  });

  it("retains safe source metadata without materializing the quote", () => {
    const observedAt = "2026-07-11T23:30:00.000Z";
    const view = build({
      now: new Date("2026-07-12T02:00:00.000Z"),
      timeZone: "America/Los_Angeles",
      evidence: [
        evidence({
          observedAt,
          source: "journal",
          quote: "Maya counted every shell without help.",
          checkInId: null,
        }),
      ],
    });
    const topic = findTopic(view, "math.counts-to-5");

    assert.equal(topic?.state, "observed_today");
    assert.equal(topic?.observedAt, observedAt);
    assert.deepEqual(topic?.source, {
      kind: "journal",
      adultDisplayName: "Elena",
      checkInId: null,
    });
    assert.equal(topic?.detail, "Observed in a journal note.");
    assert.equal(
      JSON.stringify(view).includes(
        "Maya counted every shell without help.",
      ),
      false,
    );
  });

  it("uses the family date boundary instead of UTC or elapsed hours", () => {
    const view = build({
      now: new Date("2026-07-11T04:30:00.000Z"),
      timeZone: "America/New_York",
      evidence: [
        evidence({
          observedAt: "2026-07-11T03:30:00.000Z",
        }),
      ],
    });

    assert.equal(findTopic(view, "math.counts-to-5")?.state, "older");
  });

  it("omits empty subjects and applies registry and age ordering", () => {
    const rows = [
      evidence({
        id: "literacy",
        itemId: "literacy.book-handling",
      }),
      evidence({
        id: "math-addition",
        itemId: "math.adds-with-objects",
      }),
      evidence({
        id: "taxonomy",
        itemId: TAXONOMY_ONLY_ITEM_ID,
      }),
      evidence({
        id: "math-small-groups",
        itemId: "math.small-groups",
      }),
      evidence({
        id: "math-counts",
        itemId: "math.counts-to-5",
      }),
    ];

    const view = build({ evidence: rows });
    const math = view.subjects[0];

    assert.deepEqual(
      view.subjects.map((subject) => subject.subjectId),
      ["math", "literacy"],
    );
    assert.deepEqual(
      math?.domains.map((domain) => domain.domainId),
      ["counting-cardinality", "addition-subtraction"],
    );
    assert.deepEqual(
      math?.domains[0]?.topics.map((topic) => topic.itemId),
      [
        "math.counts-to-5",
        "math.small-groups",
        TAXONOMY_ONLY_ITEM_ID,
      ],
    );
  });

  it("adds one unanswered eligible bank item and skips bundled items", () => {
    const now = new Date("2026-07-11T18:00:00.000Z");
    const view = build({
      child: {
        id: CHILD.id,
        name: CHILD.name,
        birthDate: "2018-11-11",
      },
      now,
      evidence: [
        evidence({
          itemId: "math.derived-facts",
          answer: "easily",
        }),
      ],
    });
    const askNext = view.subjects[0]?.domains.flatMap((domain) =>
      domain.topics.filter((topic) => topic.state === "ask_next"),
    );

    assert.deepEqual(
      askNext?.map((topic) => topic.itemId),
      ["math.times-tables"],
    );
    assert.equal(
      view.subjects[0]?.domains.some((domain) =>
        domain.topics.some((topic) => topic.itemId === "math.skip-counting"),
      ),
      false,
    );
  });

  it("does not ask a not-sure or skipped item again immediately", () => {
    for (const answer of ["not_sure", "skip"] as const) {
      const view = build({
        evidence: [
          evidence({
            id: `older-${answer}`,
            itemId: "math.counts-to-5",
          }),
        ],
        selectionAnswers: [
          {
            selectionId: `response-${answer}`,
            evidenceId: null,
            itemId: "math.mental-add-10",
            answer,
            answeredAt: "2026-07-11T17:00:00.000Z",
          },
        ],
      });
      const askNext = view.subjects[0]?.domains.flatMap((domain) =>
        domain.topics.filter((topic) => topic.state === "ask_next"),
      );

      assert.equal(
        askNext?.some(
          (topic) => topic.itemId === "math.mental-add-10",
        ),
        false,
      );
    }
  });

  it("lets effective evidence override its duplicate response row", () => {
    const view = build({
      evidence: [
        evidence({
          id: "effective-answer",
          itemId: "math.mental-add-10",
          answer: "easily",
        }),
      ],
      selectionAnswers: [
        {
          selectionId: "response-row",
          evidenceId: "effective-answer",
          itemId: "math.mental-add-10",
          answer: "not_yet",
          answeredAt: "2026-07-11T17:45:00.000001Z",
        },
      ],
    });
    const askNext = view.subjects[0]?.domains.flatMap((domain) =>
      domain.topics.filter((topic) => topic.state === "ask_next"),
    );

    assert.deepEqual(
      askNext?.map((topic) => topic.itemId),
      ["math.derived-facts"],
    );
  });

  it("excludes a response linked to superseded evidence", () => {
    const view = build({
      evidence: [
        evidence({
          id: "active-counting",
          itemId: "math.counts-to-5",
        }),
        evidence({
          id: "superseded-response-evidence",
          itemId: "math.mental-add-10",
          answer: "not_yet",
          supersededAt: "2026-07-11T17:40:00.000000Z",
        }),
      ],
      selectionAnswers: [
        {
          selectionId: "superseded-response",
          evidenceId: "superseded-response-evidence",
          itemId: "math.mental-add-10",
          answer: "not_yet",
          answeredAt: "2026-07-11T17:30:00.000000Z",
        },
      ],
    });
    const askNext = view.subjects[0]?.domains.flatMap((domain) =>
      domain.topics.filter((topic) => topic.state === "ask_next"),
    );

    assert.deepEqual(
      askNext?.map((topic) => topic.itemId),
      ["math.mental-add-10"],
    );
  });

  it("uses the next family-local birthday in an ahead-of-UTC zone", () => {
    const view = build({
      child: {
        id: CHILD.id,
        name: CHILD.name,
        birthDate: "2019-07-11",
      },
      now: new Date("2026-07-10T14:30:00.000Z"),
      timeZone: "Pacific/Kiritimati",
      evidence: [evidence({ itemId: "math.counts-to-5" })],
    });
    const askNext = view.subjects[0]?.domains.flatMap((domain) =>
      domain.topics.filter((topic) => topic.state === "ask_next"),
    );

    assert.deepEqual(
      askNext?.map((topic) => topic.itemId),
      ["math.mental-add-10"],
    );
  });

  it("keeps the prior family-local age in a behind-UTC zone", () => {
    const view = build({
      child: {
        id: CHILD.id,
        name: CHILD.name,
        birthDate: "2019-07-11",
      },
      now: new Date("2026-07-11T01:00:00.000Z"),
      timeZone: "America/Los_Angeles",
      evidence: [evidence({ itemId: "math.counts-to-5" })],
    });
    const askNext = view.subjects[0]?.domains.flatMap((domain) =>
      domain.topics.filter((topic) => topic.state === "ask_next"),
    );

    assert.deepEqual(
      askNext?.map((topic) => topic.itemId),
      ["math.counts-to-100"],
    );
  });

  it("rejects mixed-child projection input", () => {
    assert.throws(
      () =>
        build({
          evidence: [evidence({ childId: "child-2" })],
        }),
      {
        name: "TypeError",
        message:
          'Progress evidence "evidence-default" belongs to child "child-2" in family "family-1"; expected child "child-1" in family "family-1"',
      },
    );
  });
});
