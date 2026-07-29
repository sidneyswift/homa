import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { REVIEW_PAGE_CAP, selectPagesForReview } from "./review-artifact";

/**
 * Which pages the reviewer looks at (gh#346).
 *
 * The reviewer sees at most REVIEW_PAGE_CAP pages. Until 2026-07-28 it
 * always saw the first N in document order, so revising page 5 of a
 * 12-page packet checked pages 1 to 4: precisely the pages nobody had
 * asked about. A parent spent four days being told her packet passed.
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
