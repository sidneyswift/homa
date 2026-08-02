import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHILD_PROGRESS_PROJECTION_VERSION,
  scoreMap,
} from "@homa/core";

import { parseSyncProgressRows } from "../sync/pull";

const projection = {
  childId: "child-1",
  childName: "Maya",
  birthDate: "2019-07-01",
  timeZone: "America/Chicago",
  projectedAt: "2026-08-02T20:00:00.000Z",
  scores: scoreMap(85, []),
  subjects: [],
  conflicts: [],
};

describe("device sync Progress projection gate", () => {
  it("returns only strict current-version projections", () => {
    const rows = parseSyncProgressRows([
      {
        child_id: "child-stale",
        projection,
        projection_version: "3",
        updated_at: "2026-08-02T20:00:00.000Z",
      },
      {
        child_id: projection.childId,
        projection,
        projection_version: CHILD_PROGRESS_PROJECTION_VERSION,
        updated_at: "2026-08-02T20:01:00.000Z",
      },
    ]);

    assert.deepEqual(rows, [{
      childId: projection.childId,
      projection,
      updatedAt: "2026-08-02T20:01:00.000Z",
    }]);
  });

  it("fails closed on malformed current-version JSON", () => {
    assert.throws(() =>
      parseSyncProgressRows([{
        child_id: projection.childId,
        projection: { ...projection, unknownRoot: true },
        projection_version: CHILD_PROGRESS_PROJECTION_VERSION,
        updated_at: "2026-08-02T20:01:00.000Z",
      }])
    );
  });
});
