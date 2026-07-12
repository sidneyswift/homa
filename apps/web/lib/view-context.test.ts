import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  kidSwitchTargetPath,
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
