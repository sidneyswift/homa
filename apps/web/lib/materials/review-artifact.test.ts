import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import type { RecipeChecklistItem } from "./recipe-checklist";
import {
  buildChunkSchema,
  planReviewChunks,
  reviewArtifact,
  REVIEW_MAX_PAGES,
  REVIEW_PAGE_CAP,
  selectPagesForReview,
  type ReviewModelRunner,
} from "./review-artifact";

/**
 * Which pages the reviewer looks at (gh#346), and which of their
 * verdicts may hold a document back (gh#368).
 *
 * The reviewer sees at most REVIEW_PAGE_CAP pages per call. Until
 * 2026-07-28 it always saw the first N in document order, so revising
 * page 5 of a 12-page packet checked pages 1 to 4: precisely the pages
 * nobody had asked about. A parent spent four days being told her
 * packet passed. Until 2026-07-30 there was only ever one call, so
 * 41.4% of every page Homa had shipped went out with nothing having
 * looked at it.
 */

function page(pageNumber: number, fresh: boolean) {
  return { data: Buffer.from(`page-${pageNumber}`), pageNumber, fresh };
}

describe("selectPagesForReview", () => {
  it("shows the changed page of a packet instead of the untouched ones", () => {
    const pages = [
      page(1, false),
      page(2, false),
      page(3, false),
      page(4, false),
      page(5, true),
      page(6, false),
    ];
    const shown = selectPagesForReview(pages).map((entry) => entry.pageNumber);
    assert.ok(shown.includes(5), "the revised page must be reviewed");
    assert.equal(shown.length, REVIEW_PAGE_CAP);
  });

  it("returns the selection in reading order so issue page numbers mean something", () => {
    const pages = [page(1, false), page(2, false), page(3, true)];
    const shown = selectPagesForReview(pages).map((entry) => entry.pageNumber);
    assert.deepEqual(shown, [1, 2, 3]);
  });

  it("keeps document order for a first build, where every page is fresh", () => {
    const pages = [1, 2, 3, 4, 5, 6].map((number) => page(number, true));
    const shown = selectPagesForReview(pages).map((entry) => entry.pageNumber);
    assert.deepEqual(shown, [1, 2, 3, 4]);
  });

  it("prefers every changed page before any carried-over page", () => {
    const pages = [
      page(1, false),
      page(2, true),
      page(3, false),
      page(4, true),
      page(5, true),
    ];
    const shown = selectPagesForReview(pages).map((entry) => entry.pageNumber);
    assert.deepEqual(shown, [1, 2, 4, 5], "all three fresh pages, then a filler");
  });

  it("reviews a single-page material without ceremony", () => {
    const shown = selectPagesForReview([page(1, true)]);
    assert.deepEqual(
      shown.map((entry) => entry.pageNumber),
      [1],
    );
  });

  it("never returns more than the cap, whatever the packet length", () => {
    const pages = Array.from({ length: 12 }, (_, index) => page(index + 1, true));
    assert.equal(selectPagesForReview(pages).length, REVIEW_PAGE_CAP);
  });
});

describe("planReviewChunks", () => {
  const shapes: Array<{ name: string; pages: ReturnType<typeof page>[] }> = [
    { name: "one page", pages: [page(1, true)] },
    {
      name: "a four-page first build",
      pages: [1, 2, 3, 4].map((n) => page(n, true)),
    },
    {
      name: "a twelve-page first build",
      pages: Array.from({ length: 12 }, (_, i) => page(i + 1, true)),
    },
    {
      name: "a twelve-page revision touching page 9 only",
      pages: Array.from({ length: 12 }, (_, i) => page(i + 1, i + 1 === 9)),
    },
    {
      name: "a seven-page revision touching pages 2, 5 and 7",
      pages: Array.from({ length: 7 }, (_, i) =>
        page(i + 1, [2, 5, 7].includes(i + 1)),
      ),
    },
  ];

  /**
   * The guarantee that made full coverage safe to turn on: coverage adds
   * calls, it never promotes a page into the set whose verdict can
   * withhold the document. Asserted against selectPagesForReview itself
   * rather than against a restatement of its rule, because the rule is
   * "changed pages first" and a hand-written expectation of it would
   * drift the first time that changes.
   */
  for (const shape of shapes) {
    it(`blocks on exactly the old selection: ${shape.name}`, () => {
      const { blocking } = planReviewChunks(shape.pages);
      assert.deepEqual(blocking, selectPagesForReview(shape.pages));
    });

    it(`reviews every page exactly once: ${shape.name}`, () => {
      const { blocking, advisory } = planReviewChunks(shape.pages);
      const seen = [...blocking, ...advisory.flat()].map((p) => p.pageNumber);
      assert.deepEqual(
        [...seen].sort((a, b) => a - b),
        shape.pages.map((p) => p.pageNumber),
        "every page reaches a reviewer",
      );
      assert.equal(new Set(seen).size, seen.length, "and none is paid for twice");
    });

    it(`keeps every call inside the input-token ceiling: ${shape.name}`, () => {
      const { blocking, advisory } = planReviewChunks(shape.pages);
      assert.ok(blocking.length <= REVIEW_PAGE_CAP);
      for (const chunk of advisory) {
        assert.ok(chunk.length > 0 && chunk.length <= REVIEW_PAGE_CAP);
      }
    });
  }

  it("spends nothing extra on the common case, a material of four pages or fewer", () => {
    // 155 of 227 real materials are this shape (2026-07-30), which is
    // why full coverage costs 1.45x calls and not the 3x it was feared
    // to cost. If this ever fails, the cost projection on gh#368 is void.
    for (const length of [1, 2, 3, 4]) {
      const pages = Array.from({ length }, (_, i) => page(i + 1, true));
      assert.deepEqual(planReviewChunks(pages).advisory, [], `${length} pages`);
    }
  });

  it("splits a twelve-page packet into one blocking call and two advisory ones", () => {
    const pages = Array.from({ length: 12 }, (_, i) => page(i + 1, true));
    const { blocking, advisory } = planReviewChunks(pages);
    assert.deepEqual(blocking.map((p) => p.pageNumber), [1, 2, 3, 4]);
    assert.deepEqual(
      advisory.map((chunk) => chunk.map((p) => p.pageNumber)),
      [
        [5, 6, 7, 8],
        [9, 10, 11, 12],
      ],
    );
  });

  it("puts the changed page in the blocking call and the rest in advisory ones", () => {
    const pages = Array.from({ length: 12 }, (_, i) => page(i + 1, i + 1 === 9));
    const { blocking, advisory } = planReviewChunks(pages);
    assert.ok(
      blocking.map((p) => p.pageNumber).includes(9),
      "the page she asked about still gates delivery",
    );
    assert.ok(
      advisory.flat().every((p) => p.pageNumber !== 9),
      "and is not paid for twice",
    );
  });

  it("stops at the ceiling instead of letting one document spawn unbounded calls", () => {
    const pages = Array.from({ length: 40 }, (_, i) => page(i + 1, true));
    const { blocking, advisory } = planReviewChunks(pages);
    assert.equal(blocking.length + advisory.flat().length, REVIEW_MAX_PAGES);
  });

  it("falls back to exactly the old single call when full coverage is switched off", () => {
    const previous = process.env.HOMA_MATERIALS_REVIEW_FULL;
    process.env.HOMA_MATERIALS_REVIEW_FULL = "off";
    try {
      const pages = Array.from({ length: 12 }, (_, i) => page(i + 1, true));
      const { blocking, advisory } = planReviewChunks(pages);
      assert.deepEqual(advisory, [], "no extra calls");
      assert.deepEqual(blocking, selectPagesForReview(pages), "old behavior");
    } finally {
      if (previous === undefined) delete process.env.HOMA_MATERIALS_REVIEW_FULL;
      else process.env.HOMA_MATERIALS_REVIEW_FULL = previous;
    }
  });
});

describe("buildChunkSchema", () => {
  // The reviewer's output contract for a recipe checklist (2026-09-02):
  // the model chooses among closed answers over ids drawn from the
  // recipe, never free text, so code can decide what each answer means.
  const items: readonly RecipeChecklistItem[] = [
    { id: "trace-box-count", severity: "blocking", check: "Exactly four trace boxes sit in one row." },
    { id: "fade-order", severity: "advisory", check: "Support fades left to right across the row." },
  ];

  it("keeps the plain verdict schema for an empty checklist, dropping any checklist key", () => {
    const parsed = buildChunkSchema([]).parse({
      pass: true,
      issues: [],
      checklist: [{ id: "anything", answer: "no", note: "" }],
    });
    assert.deepEqual(parsed, { pass: true, issues: [] });
  });

  it("enumerates exactly the recipe's item ids and the three closed answers, with no length bounds", () => {
    // Bounds on the answers array or the note would fail the whole review
    // on a model quirk and ship the page unchecked; the verifier absorbs
    // duplicates, omissions, and long notes instead.
    const json = z.toJSONSchema(buildChunkSchema(items)) as unknown as {
      properties: {
        checklist: {
          items: {
            properties: {
              id: { enum: string[] };
              answer: { enum: string[] };
              note: { maxLength?: number };
            };
          };
          minItems?: number;
          maxItems?: number;
        };
      };
    };
    const checklist = json.properties.checklist;
    assert.deepEqual(checklist.items.properties.id.enum, ["trace-box-count", "fade-order"]);
    assert.deepEqual(checklist.items.properties.answer.enum, ["yes", "no", "cannot_tell"]);
    assert.equal(checklist.minItems, undefined);
    assert.equal(checklist.maxItems, undefined);
    assert.equal(checklist.items.properties.note.maxLength, undefined);
  });

  it("parses an object with no checklist key at all, leaving the items to be recorded as unanswered", () => {
    const parsed = buildChunkSchema(items).safeParse({ pass: true, issues: [] });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success ? parsed.data.checklist : "present", undefined);
  });

  it("parses an empty answer set, a repeated id, and a long note instead of failing", () => {
    const schema = buildChunkSchema(items);
    assert.equal(schema.safeParse({ pass: true, issues: [], checklist: [] }).success, true);
    assert.equal(
      schema.safeParse({
        pass: true,
        issues: [],
        checklist: [
          { id: "fade-order", answer: "yes", note: "" },
          { id: "fade-order", answer: "no", note: "x".repeat(2_000) },
          { id: "trace-box-count", answer: "cannot_tell", note: "" },
        ],
      }).success,
      true,
    );
  });

  it("rejects an answer for an id the recipe never declared", () => {
    const result = buildChunkSchema(items).safeParse({
      pass: true,
      issues: [],
      checklist: [{ id: "made-up", answer: "yes", note: "" }],
    });
    assert.equal(result.success, false);
  });

  it("accepts a complete, well-formed answer set", () => {
    const parsed = buildChunkSchema(items).parse({
      pass: false,
      issues: ["Page 1: three boxes, not four."],
      checklist: [
        { id: "trace-box-count", answer: "no", note: "Page 1 shows three boxes." },
        { id: "fade-order", answer: "yes", note: "" },
      ],
    });
    assert.equal(parsed.checklist?.length, 2);
    assert.equal(parsed.checklist?.[0].answer, "no");
  });
});

describe("reviewArtifact assembly", () => {
  // Which chunk's checklist findings land where, in what words. A six-page
  // recipe material has a blocking chunk (pages 1 to 4) and an advisory
  // chunk (pages 5, 6); before this test, a blocking-severity no on the
  // advisory chunk carried its Checklist (<id>) label into advisoryIssues,
  // which create_printable tells Homa to relay to the parent in one plain
  // sentence (review of PR #1069).
  const items: readonly RecipeChecklistItem[] = [
    { id: "trace-box-count", severity: "blocking", check: "Each model box has exactly four trace boxes beneath it." },
    { id: "fade-order", severity: "advisory", check: "Support fades left to right across the trace row." },
  ];
  const sixPages = Array.from({ length: 6 }, (_, index) => page(index + 1, true));
  const noUsage = async () => undefined;

  function run(
    answers: (later: boolean) => { pass: boolean; issues: string[]; checklist?: Array<{ id: string; answer: "yes" | "no" | "cannot_tell"; note: string }> },
  ): ReviewModelRunner {
    return async (call) => ({
      object: answers(call.text.includes("pages 5, 6")),
      usage: {},
    });
  }

  it("relays a later chunk's checklist findings in plain words, never with the internal label", async () => {
    const review = await reviewArtifact(
      {
        familyId: "family-a",
        channel: "web",
        pages: sixPages,
        pageCount: 6,
        brief: "Title: Letter B",
        checklist: items,
        recipe: "letter-number-formation-practice",
      },
      {
        run: run((later) =>
          later
            ? {
                pass: true,
                issues: ["Page 5: the title is cut off at the right edge."],
                checklist: [
                  { id: "trace-box-count", answer: "no", note: "Page 6 shows three boxes." },
                ],
              }
            : {
                pass: true,
                issues: [],
                checklist: [
                  { id: "trace-box-count", answer: "yes", note: "" },
                  { id: "fade-order", answer: "yes", note: "" },
                ],
              },
        ),
        recordUsage: noUsage,
      },
    );
    assert.ok(review);
    assert.equal(review.pass, true, "a later page never holds the document back");
    assert.deepEqual(review.issues, []);
    assert.deepEqual(review.advisoryIssues, ["Page 5: the title is cut off at the right edge."]);
    assert.deepEqual(review.checklistAdvisory, [
      "Each model box has exactly four trace boxes beneath it. Reviewer: Page 6 shows three boxes.",
    ]);
    assert.deepEqual(review.checklistUnconfirmed, [
      "Support fades left to right across the trace row.",
    ]);
    const relayed = JSON.stringify([
      review.advisoryIssues,
      review.checklistAdvisory,
      review.checklistUnconfirmed,
    ]);
    assert.doesNotMatch(relayed, /Checklist \(/, "no internal label in anything Homa relays");
    assert.deepEqual(review.reviewedPages, [1, 2, 3, 4, 5, 6]);
  });

  it("keeps the label on the blocking chunk's issues, which Homa fixes rather than relays", async () => {
    const review = await reviewArtifact(
      {
        familyId: "family-a",
        channel: "web",
        pages: sixPages,
        pageCount: 6,
        brief: "Title: Letter B",
        checklist: items,
        recipe: "letter-number-formation-practice",
      },
      {
        run: run((later) =>
          later
            ? { pass: true, issues: [] }
            : {
                pass: true,
                issues: [],
                checklist: [{ id: "trace-box-count", answer: "no", note: "Page 2 shows three boxes." }],
              },
        ),
        recordUsage: noUsage,
      },
    );
    assert.ok(review);
    assert.equal(review.pass, false);
    assert.match(review.issues[0], /^Checklist \(trace-box-count\): /);
    assert.deepEqual(review.checklist?.blockingFailures, ["trace-box-count"]);
    // The later chunk returned no checklist key at all: unanswered, not a
    // null review, and both items surface as unconfirmed in plain words.
    assert.equal(review.checklistUnconfirmed.length, 2);
    assert.doesNotMatch(JSON.stringify(review.checklistUnconfirmed), /Checklist \(/);
  });
});
