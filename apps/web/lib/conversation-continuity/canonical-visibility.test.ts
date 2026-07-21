import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatHiddenDirective } from "../onboarding/directives";
import { canonicalMessageVisibility } from "./ledger";

describe("canonicalMessageVisibility", () => {
  it("keeps the parent's own web message in family-visible history", () => {
    assert.equal(
      canonicalMessageVisibility({
        channel: "web",
        role: "user",
        terminal: undefined,
        content: "Mia is six and reads everything",
      }),
      "family",
    );
  });

  it("hides an onboarding directive she never typed", () => {
    assert.equal(
      canonicalMessageVisibility({
        channel: "web",
        role: "user",
        terminal: undefined,
        content: formatHiddenDirective("kickoff"),
      }),
      "internal",
    );
    assert.equal(
      canonicalMessageVisibility({
        channel: "web",
        role: "user",
        terminal: undefined,
        content: formatHiddenDirective("checklist_complete", {
          childId: "abc",
          answered: 41,
        }),
      }),
      "internal",
    );
  });

  it("leaves every pre-existing visibility rule exactly as it was", () => {
    assert.equal(
      canonicalMessageVisibility({
        channel: "dispatch",
        role: "assistant",
        terminal: true,
        content: "brief",
      }),
      "internal",
    );
    assert.equal(
      canonicalMessageVisibility({
        channel: "dispatch",
        role: "user",
        terminal: undefined,
        content: "internal prompt",
      }),
      "internal",
    );
    assert.equal(
      canonicalMessageVisibility({
        channel: "web",
        role: "assistant",
        terminal: false,
        content: "half a reply",
      }),
      "internal",
    );
    assert.equal(
      canonicalMessageVisibility({
        channel: "web",
        role: "assistant",
        terminal: true,
        content: "the reply she read",
      }),
      "family",
    );
    for (const channel of ["sms", "email"] as const) {
      assert.equal(
        canonicalMessageVisibility({
          channel,
          role: "assistant",
          terminal: true,
          content: "sent text",
        }),
        "internal",
      );
      assert.equal(
        canonicalMessageVisibility({
          channel,
          role: "user",
          terminal: undefined,
          content: "her reply",
        }),
        "family",
      );
    }
  });
});
