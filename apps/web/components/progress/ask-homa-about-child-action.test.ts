import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  focusChildThenOpenChat,
} from "./ask-homa-about-child-action";

describe("focusChildThenOpenChat", () => {
  it("does not navigate when the authenticated child selection fails", async () => {
    let navigated = false;
    await assert.rejects(focusChildThenOpenChat("stale-child", {
      setViewContext: async () => { throw new Error("view_context_unavailable"); },
      navigate: () => { navigated = true; },
    }), /view_context_unavailable/u);
    assert.equal(navigated, false);
  });
  it("saves the child focus before opening chat", async () => {
    const order: string[] = [];

    await focusChildThenOpenChat("child-1", {
      setViewContext: async (childId) => {
        order.push(`focus:${childId}`);
      },
      navigate: (href) => {
        order.push(`navigate:${href}`);
      },
    });

    assert.deepEqual(order, [
      "focus:child-1",
      "navigate:/app",
    ]);
  });
});
