import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  kidSwitchTargetPath,
  pageShowsContextSwitcher,
  plannerPathAfterContextPick,
  resolvePlannerViewContext,
  resolveProgressChildId,
} from "./view-context";

describe("Planner scope across links and saved preference", () => {
  const children = ["child-one", "child-two"];

  it("uses the same owned linked child instead of a different saved preference", () => {
    assert.deepEqual(resolvePlannerViewContext("child-one", "child-two", children), {
      context: { kind: "child", childId: "child-two" }, linkedChildId: "child-two",
    });
  });

  it("falls back identically for missing, stale, foreign, and repeated child queries", () => {
    for (const query of [undefined, "", "foreign-child", ["child-two", "child-one"], ["child-two", "child-two"]]) {
      assert.deepEqual(resolvePlannerViewContext("child-one", query, children), {
        context: { kind: "child", childId: "child-one" }, linkedChildId: null,
      });
    }
  });

  it("never exposes an unowned saved preference or false report handoff", () => {
    assert.deepEqual(resolvePlannerViewContext("deleted-child", "foreign-child", children), {
      context: { kind: "family" }, linkedChildId: null,
    });
    assert.deepEqual(resolvePlannerViewContext("child-one", "child-one", []), {
      context: { kind: "family" }, linkedChildId: null,
    });
  });

  it("an explicit pick clears every child override and entry handoff, preserving view/date", () => {
    assert.equal(plannerPathAfterContextPick("/app/planner", "view=hours&child=child-two&child=child-one&date=2026-09-06&handoff=report"),
      "/app/planner?view=hours&date=2026-09-06");
    assert.equal(plannerPathAfterContextPick("/app/planner", "child=child-two"), "/app/planner");
    assert.equal(plannerPathAfterContextPick("/app/planner", "view=week"), null);
    assert.equal(plannerPathAfterContextPick("/app/binder", "child=child-two"), null);
  });
});

describe("kidSwitchTargetPath", () => {
  it("keeps a child switch on the live Progress surface", () => {
    assert.equal(
      kidSwitchTargetPath("/app/child-one/progress", "child-two"),
      "/app/child-two/progress",
    );
  });

  it("preserves the legacy report switching behavior", () => {
    assert.equal(
      kidSwitchTargetPath("/app/child-one/report", "child-two"),
      "/app/child-two/report",
    );
  });

  it("sends a firsts-page switch to the sibling's PROGRESS page", () => {
    // Never the sibling's firsts page: that lands an empty keepsake on
    // top of a full one and performs a comparison in one tap.
    assert.equal(
      kidSwitchTargetPath("/app/child-one/firsts", "child-two"),
      "/app/child-two/progress",
    );
  });

  it("stays put on an unrelated app path", () => {
    assert.equal(kidSwitchTargetPath("/app/planner", "child-two"), null);
  });
});

describe("pageShowsContextSwitcher", () => {
  it("shows on the surfaces the selection affects", () => {
    for (const pathname of [
      "/app",
      "/app/child-one/progress",
      "/app/progress",
      "/app/planner",
      "/app/binder",
      "/app/child-one/report",
      "/app/kids/child-one",
    ]) {
      assert.equal(pageShowsContextSwitcher(pathname), true, pathname);
    }
  });

  it("hides on the surfaces that ignore the selection", () => {
    for (const pathname of [
      "/app/tasks",
      "/app/settings",
      "/app/settings/billing",
    ]) {
      assert.equal(pageShowsContextSwitcher(pathname), false, pathname);
    }
  });

  it("never shows outside the app frame", () => {
    assert.equal(pageShowsContextSwitcher("/onboarding"), false);
    assert.equal(pageShowsContextSwitcher("/apple"), false);
  });
});

describe("resolveProgressChildId", () => {
  it("uses the focused family child first", () => {
    assert.equal(
      resolveProgressChildId(
        { kind: "child", childId: "child-two" },
        ["child-one", "child-two"],
      ),
      "child-two",
    );
  });

  it("uses the first child without requiring a legacy report", () => {
    assert.equal(
      resolveProgressChildId(
        { kind: "family" },
        ["child-without-report", "child-with-report"],
      ),
      "child-without-report",
    );
  });

  it("falls back safely when a focused child is stale", () => {
    assert.equal(
      resolveProgressChildId(
        { kind: "child", childId: "removed-child" },
        ["current-child"],
      ),
      "current-child",
    );
  });

  it("returns null when setup has no children", () => {
    assert.equal(
      resolveProgressChildId({ kind: "family" }, []),
      null,
    );
  });
});
