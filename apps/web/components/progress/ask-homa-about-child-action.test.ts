import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  focusChildThenOpenChat,
} from "./ask-homa-about-child-action";

describe("focusChildThenOpenChat", () => {
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
