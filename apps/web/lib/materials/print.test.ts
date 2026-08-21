import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectedPrintPages } from "./print";

describe("material print page selection", () => {
  it("keeps every page when the answer key is requested", () => {
    assert.deepEqual(
      selectedPrintPages({ pageCount: 3, pageRoles: null, includeAnswerKey: true }),
      [0, 1, 2],
    );
  });

  it("removes only verified answer-key pages", () => {
    assert.deepEqual(
      selectedPrintPages({
        pageCount: 3,
        pageRoles: ["child", "answer_key", "parent_guide"],
        includeAnswerKey: false,
      }),
      [0, 2],
    );
  });

  it("fails closed when an older packet has no page roles", () => {
    assert.equal(
      selectedPrintPages({ pageCount: 2, pageRoles: null, includeAnswerKey: false }),
      null,
    );
  });

  it("prints the single page of an unlabeled one-page worksheet", () => {
    assert.deepEqual(
      selectedPrintPages({ pageCount: 1, pageRoles: null, includeAnswerKey: false }),
      [0],
    );
  });
});
