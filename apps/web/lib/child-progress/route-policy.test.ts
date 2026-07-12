import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadChildProgressPageState } from "./page-state";
import { progressRoutePolicy } from "./route-policy";

const CHILD_ID = "child-1";

describe("live Progress route policy", () => {
  it("covers every flag and route direction without redirect loops", () => {
    const matrix = [
      {
        route: { surface: "progress_index" as const },
        enabled: false,
        expected: { kind: "redirect", href: "/app/report" },
        destination: { surface: "report_index" as const },
      },
      {
        route: {
          surface: "child_progress" as const,
          childId: CHILD_ID,
        },
        enabled: false,
        expected: {
          kind: "redirect",
          href: `/app/${CHILD_ID}/report`,
        },
        destination: {
          surface: "child_report" as const,
          childId: CHILD_ID,
        },
      },
      {
        route: { surface: "report_index" as const },
        enabled: true,
        expected: {
          kind: "redirect",
          href: "/app/progress",
        },
        destination: { surface: "progress_index" as const },
      },
      {
        route: {
          surface: "child_report" as const,
          childId: CHILD_ID,
        },
        enabled: true,
        expected: {
          kind: "redirect",
          href: `/app/${CHILD_ID}/progress`,
        },
        destination: {
          surface: "child_progress" as const,
          childId: CHILD_ID,
        },
      },
    ];

    for (const row of matrix) {
      assert.deepEqual(
        progressRoutePolicy(row.route, row.enabled),
        row.expected,
      );
      assert.deepEqual(
        progressRoutePolicy(row.destination, row.enabled),
        { kind: "continue" },
      );
    }
  });

  it("never redirects permanent token reports", () => {
    for (const enabled of [false, true]) {
      assert.deepEqual(
        progressRoutePolicy(
          { surface: "token_report" },
          enabled,
        ),
        { kind: "continue" },
      );
    }
  });

  it("keeps read errors and empty data on child Progress", async () => {
    const base = {
      familyId: "family-1",
      child: {
        id: CHILD_ID,
        name: "Maya",
        birthDate: "2019-07-01",
      },
      timeZone: "America/Chicago",
      now: new Date("2026-07-12T06:00:00.000Z"),
    };
    const unavailable = await loadChildProgressPageState(
      base,
      {
        loadView: async () => {
          throw new Error("read failed");
        },
      },
    );
    const empty = await loadChildProgressPageState(
      base,
      { loadView: async () => null },
    );

    assert.equal(unavailable.status, "unavailable");
    assert.equal("redirectTo" in unavailable, false);
    assert.equal(empty.status, "ready");
    if (empty.status !== "ready") {
      throw new Error("Expected empty Progress view");
    }
    assert.deepEqual(empty.view.subjects, []);
    assert.equal("redirectTo" in empty, false);
  });
});
