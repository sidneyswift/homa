import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
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
