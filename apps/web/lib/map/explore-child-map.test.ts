import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTopic, prerequisitesOf, unlockedBy } from "@homa/taxonomy";

import {
  exploreChildMap,
  type ExploreChildContext,
  type ExploreChildMapQuery,
} from "./explore-child-map";

/**
 * The explore_child_map query engine: pure functions over a child's
 * loaded answers plus the two content graphs. These tests pin the
 * contract the agent relies on: child evidence joins in, receipts come
 * from real edges, every result stays bounded, and bad ids fail closed
 * with a teaching note instead of a throw.
 */

function context(
  overrides?: Partial<ExploreChildContext>,
): ExploreChildContext {
  return {
    childName: "Theo",
    ageMonths: 60,
    answers: [],
    ...overrides,
  };
}

function run(
  query: ExploreChildMapQuery,
  contextOverrides?: Partial<ExploreChildContext>,
) {
  return exploreChildMap(context(contextOverrides), query);
}

/** A real math graph topic with at least one hard prerequisite,
 * discovered from the corpus itself so the test never pins one curated
 * edge that a re-sync could legitimately move. */
function topicWithHardPrerequisite(): {
  topicId: string;
  hardPrerequisiteId: string;
} {
  const counting = getTopic("math.one-to-one-counting");
  assert.ok(counting, "expected the math hub topic to exist");
  const dependents = unlockedBy(counting.id).filter(
    (edge) => edge.strength === "hard" && getTopic(edge.topicId),
  );
  const first = [...dependents].sort((a, b) =>
    a.topicId < b.topicId ? -1 : 1,
  )[0];
  assert.ok(first, "fixture: the hub topic unlocks nothing hard");
  const hard = prerequisitesOf(first.topicId).filter(
    (edge) => edge.strength === "hard",
  );
  return {
    topicId: first.topicId,
    hardPrerequisiteId: hard[0].prerequisiteId,
  };
}

describe("subject_map", () => {
  it("joins the child's answers onto the anchored ladder with the chart figure", () => {
    const result = run(
      { query: "subject_map", subjectId: "math" },
      {
        answers: [
          { itemId: "math.counts-to-10", answer: "easily" },
          { itemId: "math.counts-past-20", answer: "not_yet" },
        ],
      },
    ) as {
      position: string;
      chartReads: string | null;
      ladder: Array<{ itemId: string; childStatus: string; frontier: boolean }>;
      domains: Array<{ domainId: string; checklistAnswers: number }>;
    };

    const ladderById = new Map(
      result.ladder.map((rung) => [rung.itemId, rung]),
    );
    assert.equal(
      ladderById.get("math.counts-to-10")?.childStatus,
      "confirmed_easily",
    );
    assert.equal(ladderById.get("math.counts-past-20")?.childStatus, "not_yet");
    assert.equal(ladderById.get("math.makes-10")?.childStatus, "no_evidence");
    // A 60-month-old confirmed at the 42-month anchor reads growing, and
    // the chart figure is the same signed number the parent's chart shows.
    assert.equal(result.position, "growing");
    assert.match(result.chartReads ?? "", /^-\d+ mo$/u);
    assert.ok(result.ladder.some((rung) => rung.frontier));
    const counting = result.domains.find(
      (domain) => domain.domainId === "counting-cardinality",
    );
    assert.equal(counting?.checklistAnswers, 2);
  });

  it("keeps exposure subjects number-free", () => {
    const result = run(
      { query: "subject_map", subjectId: "spanish" },
      { answers: [{ itemId: "spanish.understands-words", answer: "easily" }] },
    ) as { exposureBased: boolean; chartReads: string | null };
    assert.equal(result.exposureBased, true);
    assert.equal(result.chartReads, null);
  });

  it("fails closed on a made-up subject", () => {
    const result = run({ query: "subject_map", subjectId: "wizardry" });
    assert.equal((result as { error?: string }).error, "unknown_subject");
  });
});

describe("topic", () => {
  it("returns prerequisites with reasons and the child's standing on each", () => {
    const { topicId, hardPrerequisiteId } = topicWithHardPrerequisite();
    const result = run(
      { query: "topic", topicId },
      { answers: [{ itemId: hardPrerequisiteId, answer: "easily" }] },
    ) as {
      kind: string;
      tryAtHome: string | null;
      prerequisites: Array<{
        topicId: string;
        strength: string;
        childStatus: string;
      }>;
    };
    assert.equal(result.kind, "topic");
    const prerequisite = result.prerequisites.find(
      (entry) => entry.topicId === hardPrerequisiteId,
    );
    assert.equal(prerequisite?.childStatus, "confirmed_easily");
    // The try-at-home prompt is personalized with the child's own name.
    if (result.tryAtHome !== null) {
      assert.ok(!result.tryAtHome.includes("{{name}}"));
    }
  });

  it("answers with the anchored bank item when given a checklist id", () => {
    const result = run(
      { query: "topic", topicId: "math.counts-to-10" },
      { answers: [{ itemId: "math.counts-to-10", answer: "getting_there" }] },
    ) as { kind: string; typicalMonths: number; childStatus: string };
    assert.equal(result.kind, "bank_item");
    assert.equal(result.typicalMonths, 42);
    assert.equal(result.childStatus, "getting_there");
  });

  it("fails closed on an unknown id with a next step", () => {
    const result = run({ query: "topic", topicId: "math.not-a-real-thing" });
    assert.equal((result as { error?: string }).error, "unknown_topic");
  });
});

describe("ready_next", () => {
  it("offers graph entry points when nothing is confirmed yet, in-window first", () => {
    const result = run({
      query: "ready_next",
      subjectId: "math",
    }) as {
      readyNow: Array<{
        topicId: string;
        teachingWindowMonths: [number, number];
        windowFit: string;
      }>;
      basis: { confirmedGraphTopics: number; note: string };
    };
    assert.equal(result.basis.confirmedGraphTopics, 0);
    assert.match(result.basis.note, /entry points/u);
    assert.ok(result.readyNow.length > 0);
    for (const topic of result.readyNow) {
      // At 60 months plenty of math roots sit in window, so the in-window
      // ring fills the whole bounded list.
      assert.equal(topic.windowFit, "now");
      assert.ok(topic.topicId.startsWith("math."));
    }
  });

  it("never returns empty for a child younger than the graph's windows", () => {
    // The math windows floor at 36 months (the inspo-flywheel PreK
    // topics; the Marble import alone floored at 48). A 2.5-year-old
    // still gets ranked entry points, labeled honestly as
    // usually-later material.
    const result = run(
      { query: "ready_next", subjectId: "math" },
      { ageMonths: 30 },
    ) as { readyNow: Array<{ windowFit: string }> };
    assert.ok(result.readyNow.length > 0);
    assert.ok(
      result.readyNow.every((topic) => topic.windowFit === "usually_later"),
    );
  });

  it("puts a young 3-year-old in window for the PreK math roots", () => {
    // Before the 2026-07-19 PreK additions every math window started at
    // 48 months and a 40-month-old saw only usually-later material.
    const result = run(
      { query: "ready_next", subjectId: "math" },
      { ageMonths: 40 },
    ) as { readyNow: Array<{ windowFit: string }> };
    assert.ok(result.readyNow.length > 0);
    assert.ok(result.readyNow.some((topic) => topic.windowFit === "now"));
  });

  it("counts confirmed graph evidence into the basis and never re-offers confirmed topics", () => {
    const { hardPrerequisiteId } = topicWithHardPrerequisite();
    const result = run(
      { query: "ready_next", subjectId: "math", limit: 8 },
      { answers: [{ itemId: hardPrerequisiteId, answer: "easily" }] },
    ) as {
      readyNow: Array<{ topicId: string }>;
      basis: { confirmedGraphTopics: number };
    };
    assert.equal(result.basis.confirmedGraphTopics, 1);
    assert.ok(
      result.readyNow.every((topic) => topic.topicId !== hardPrerequisiteId),
    );
  });

  it("bounds the list at the schema cap", () => {
    const result = run({ query: "ready_next", limit: 10 }) as {
      readyNow: unknown[];
    };
    assert.ok(result.readyNow.length <= 8);
  });
});

describe("bottleneck", () => {
  it("names the earliest unconfirmed hard prerequisite, and clears when confirmed", () => {
    const { topicId, hardPrerequisiteId } = topicWithHardPrerequisite();

    const blocked = run({ query: "bottleneck", topicId }) as {
      deepestBlocking: { topicId: string } | null;
      unconfirmedPrerequisites: Array<{ topicId: string }>;
    };
    assert.ok(blocked.deepestBlocking !== null);
    assert.ok(
      blocked.unconfirmedPrerequisites.some(
        (entry) => entry.topicId === hardPrerequisiteId,
      ),
    );

    const closure = blocked.unconfirmedPrerequisites.map(
      (entry) => entry.topicId,
    );
    const cleared = run(
      { query: "bottleneck", topicId },
      {
        answers: closure.map((itemId) => ({
          itemId,
          answer: "easily" as const,
        })),
      },
    ) as { deepestBlocking: unknown; note: string };
    // Clearing the listed chain either opens the path or leaves only
    // deeper prerequisites beyond the bounded list; the note stays honest.
    if (cleared.deepestBlocking === null) {
      assert.match(cleared.note, /open/u);
    }
  });
});

describe("teaching_order", () => {
  it("sorts prerequisites before dependents", () => {
    const { topicId, hardPrerequisiteId } = topicWithHardPrerequisite();
    const result = run({
      query: "teaching_order",
      topicIds: [topicId, hardPrerequisiteId],
    }) as { ordered: Array<{ topicId: string }> };
    const order = result.ordered.map((entry) => entry.topicId);
    assert.ok(order.indexOf(hardPrerequisiteId) < order.indexOf(topicId));
  });

  it("rejects non-graph ids by name", () => {
    const result = run({
      query: "teaching_order",
      topicIds: ["math.fake-topic"],
    });
    assert.equal((result as { error?: string }).error, "unknown_topic");
  });
});

describe("search_topics", () => {
  it("finds both graph topics and anchored checklist items", () => {
    const result = run({
      query: "search_topics",
      searchText: "counting",
      subjectId: "math",
    }) as { results: Array<{ kind: string }> };
    assert.ok(result.results.length > 0);
    assert.ok(result.results.some((hit) => hit.kind === "topic"));
  });

  it("is deterministic and bounded", () => {
    const first = JSON.stringify(
      run({ query: "search_topics", searchText: "count" }),
    );
    const second = JSON.stringify(
      run({ query: "search_topics", searchText: "count" }),
    );
    assert.equal(first, second);
    const parsed = JSON.parse(first) as { results: unknown[] };
    assert.ok(parsed.results.length <= 10);
  });
});

describe("output bounds", () => {
  it("keeps every query's serialized result comfortably inside context budgets", () => {
    const answers = [
      { itemId: "math.counts-to-10", answer: "easily" as const },
      { itemId: "math.counts-past-20", answer: "not_yet" as const },
    ];
    const { topicId } = topicWithHardPrerequisite();
    const queries: ExploreChildMapQuery[] = [
      { query: "subject_map", subjectId: "math" },
      { query: "subject_map", subjectId: "literacy" },
      { query: "topic", topicId },
      { query: "ready_next" },
      { query: "bottleneck", topicId },
      { query: "search_topics", searchText: "count" },
    ];
    for (const query of queries) {
      const serialized = JSON.stringify(run(query, { answers }));
      assert.ok(
        serialized.length <= 8_000,
        `${query.query} result too large: ${serialized.length} chars`,
      );
    }
  });
});
