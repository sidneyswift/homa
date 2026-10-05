import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readWorkspaceLocation, workspaceHref } from "./workspace-location";

describe("workspace view URLs", () => {
  it("preserves unrelated preferences and anchors while opening and closing", () => {
    const open = workspaceHref("https://homa.test/app2?preview=1#latest", { kind: "planner", childId: "child one" });
    assert.equal(open, "/app2?preview=1&workspace=planner&child=child+one#latest");
    assert.equal(workspaceHref(`https://homa.test${open}`, null), "/app2?preview=1#latest");
  });

  it("does not turn an unknown view into a planner request", () => {
    assert.equal(readWorkspaceLocation("?workspace=unknown&child=private"), null);
    assert.equal(readWorkspaceLocation("?child=private"), null);
  });

  it("retains a stale child selection for authenticated validation instead of broadening it", () => {
    assert.deepEqual(readWorkspaceLocation("?workspace=planner&child=removed-child"), { kind: "planner", childId: "removed-child" });
    assert.deepEqual(readWorkspaceLocation("?workspace=planner"), { kind: "planner", childId: null });
  });
});
