import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  kidSwitchTargetPath,
  pageShowsContextSwitcher,
  resolveProgressChildId,
} from "./view-context";

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
