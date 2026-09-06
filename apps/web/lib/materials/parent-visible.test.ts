import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  selectInProgressMaterialRevisions,
  selectKeptMaterialRevisions,
  selectParentVisibleMaterialRevisions,
  type MaterialRevisionCandidate,
} from "./parent-visible";

function revision(
  id: string,
  revisesId: string | null,
  status: MaterialRevisionCandidate["status"],
  reviewPass: boolean | null,
  order: number,
): MaterialRevisionCandidate {
  return { id, revisesId, status, reviewPass, order };
}

describe("selectParentVisibleMaterialRevisions", () => {
  it("selects one latest passing row and hides a later failed attempt", () => {
    const selected = selectParentVisibleMaterialRevisions([
      revision("v1", null, "draft", false, 1),
      revision("v2", "v1", "draft", true, 2),
      revision("v3", "v2", "draft", false, 3),
    ]);

    assert.deepEqual(
      selected.map((row) => row.id),
      ["v2"],
    );
  });

  it("prefers the final even when another failed row is newer", () => {
    const selected = selectParentVisibleMaterialRevisions([
      revision("v1", null, "final", true, 1),
      revision("v2", "v1", "draft", false, 2),
    ]);

    assert.deepEqual(
      selected.map((row) => row.id),
      ["v1"],
    );
  });

  it("shows only the newest final after an append-only restore", () => {
    const selected = selectParentVisibleMaterialRevisions([
      revision("v1", null, "final", true, 1),
      revision("v2", "v1", "superseded", true, 2),
      revision("restored-v1", "v1", "final", true, 3),
    ]);

    assert.deepEqual(selected.map((row) => row.id), ["restored-v1"]);
  });

  it("keeps independent chains ordered by their selected rows", () => {
    const selected = selectParentVisibleMaterialRevisions([
      revision("math-v1", null, "draft", true, 4),
      revision("reading-v1", null, "draft", true, 2),
      revision("math-v2", "math-v1", "draft", true, 6),
    ]);

    assert.deepEqual(
      selected.map((row) => row.id),
      ["reading-v1", "math-v2"],
    );
  });

  it("omits a chain with only superseded or failed rows", () => {
    const selected = selectParentVisibleMaterialRevisions([
      revision("v1", null, "superseded", true, 1),
      revision("v2", "v1", "draft", false, 2),
    ]);

    assert.deepEqual(selected, []);
  });
});

describe("selectInProgressMaterialRevisions", () => {
  const row = (
    id: string,
    revisesId: string | null,
    status: "draft" | "final" | "superseded",
    order: number,
    reviewPass: boolean | null = true,
  ) => ({ id, revisesId, status, reviewPass, order });

  it("returns the newest draft of a chain that never reached final", () => {
    const selected = selectInProgressMaterialRevisions([
      row("a", null, "superseded", 1),
      row("b", "a", "draft", 2),
    ]);
    assert.deepEqual(selected.map((entry) => entry.id), ["b"]);
  });

  it("omits a chain whose current node is final", () => {
    const selected = selectInProgressMaterialRevisions([
      row("a", null, "superseded", 1),
      row("b", "a", "final", 2),
    ]);
    assert.deepEqual(selected, []);
  });

  it("omits a draft that failed review, which was never shown to her", () => {
    const selected = selectInProgressMaterialRevisions([
      row("a", null, "draft", 1, false),
    ]);
    assert.deepEqual(selected, []);
  });

  it("returns one current draft per chain, not one per attempt", () => {
    const selected = selectInProgressMaterialRevisions([
      row("a", null, "superseded", 1),
      row("b", "a", "superseded", 2),
      row("c", "b", "draft", 3),
      row("x", null, "draft", 4),
    ]);
    assert.deepEqual(selected.map((entry) => entry.id), ["c", "x"]);
  });
});

describe("current review versus kept shelf", () => {
  it("a passing or unknown-review descendant becomes current while the final stays kept", () => {
    for (const review of [true, null]) {
      const rows = [revision("a", null, "final", false, 1), revision("b", "a", "draft", false, 2), revision("c", "b", "draft", review, 3)];
      assert.deepEqual(selectParentVisibleMaterialRevisions(rows).map(row => row.id), ["c"]);
      assert.deepEqual(selectInProgressMaterialRevisions(rows).map(row => row.id), ["c"]);
      assert.deepEqual(selectKeptMaterialRevisions(rows).map(row => row.id), ["a"]);
      assert.deepEqual(selectParentVisibleMaterialRevisions(rows.slice(0, 2)).map(row => row.id), ["a"]);
    }
  });
  it("kept selection groups through intervening draft nodes and preserves UUID ties", () => {
    const rows = [revision("a", null, "final", true, 1), revision("b", "a", "draft", true, 2), revision("c", "b", "final", true, 3), revision("d", "c", "draft", true, 3)];
    assert.deepEqual(selectKeptMaterialRevisions(rows).map(row => row.id), ["c"]);
    assert.deepEqual(selectParentVisibleMaterialRevisions(rows).map(row => row.id), ["d"]);
  });
  it("cyclic chains and their descendants have no current or kept node", () => {
    for (const rows of [[revision("a", "a", "final", true, 1)], [revision("a", "b", "final", true, 1), revision("b", "a", "draft", true, 2), revision("c", "b", "draft", true, 3)]]) {
      assert.deepEqual(selectParentVisibleMaterialRevisions(rows), []);
      assert.deepEqual(selectKeptMaterialRevisions(rows), []);
    }
  });
});
