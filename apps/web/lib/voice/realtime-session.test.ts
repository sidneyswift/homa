import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRealtimeInstructions,
  composeRealtimeInstructions,
  VOICE_MODE_RULES,
} from "./realtime-session";
import { VOICE_PERSONA_MARKDOWN } from "./persona.generated";

describe("realtime voice instructions", () => {
  it("puts the persona first, then how to talk, then the family", () => {
    const out = composeRealtimeInstructions({
      persona: "PERSONA",
      familyContext: "FAMILY",
    });
    assert.ok(out.indexOf("PERSONA") < out.indexOf("talking out loud"));
    assert.ok(out.indexOf("talking out loud") < out.indexOf("FAMILY"));
  });

  // Fail-soft: a family-context read that failed opens a session that is
  // less aware, never one that fails or one with a dangling empty block.
  it("omits the family block entirely when it could not be loaded", () => {
    const out = composeRealtimeInstructions({ persona: "PERSONA", familyContext: "" });
    assert.ok(out.startsWith("PERSONA"));
    assert.ok(!out.endsWith("\n\n"));
  });

  it("carries the real persona, not a placeholder", () => {
    const out = buildRealtimeInstructions("");
    assert.ok(out.includes("You are Homa"), "persona slice is present");
    assert.ok(VOICE_PERSONA_MARKDOWN.length > 500, "persona mirror is not empty");
  });

  // The persona slice must stop before web-tool operations. If the split
  // heading ever moves, the whole operations half would ship into a voice
  // session that has no tools to run any of it.
  it("stops before the web-tool operations half", () => {
    assert.ok(
      !VOICE_PERSONA_MARKDOWN.includes("## What you know each turn"),
      "the slice must not contain the split heading itself",
    );
  });
});

describe("the voice capability boundary", () => {
  // The 2026-07-19 phone call claimed a worksheet was emailed and filed in
  // the binder. This session has no tools at all, so every one of those
  // has to be named as impossible before the model can be tempted.
  for (const forbidden of ["worksheet", "binder", "calendar", "planner", "log hours", "memory"]) {
    it(`names ${forbidden} as something it cannot do`, () => {
      assert.ok(
        VOICE_MODE_RULES.toLowerCase().includes(forbidden.toLowerCase()),
        `boundary must mention ${forbidden}`,
      );
    });
  }

  it("states the honesty law, not just the list", () => {
    assert.match(VOICE_MODE_RULES, /If you did not do something, do not describe it as done/);
  });

  it("gives a real path out rather than only a refusal", () => {
    assert.match(VOICE_MODE_RULES, /this whole conversation is in\s+> your chat/);
  });

  it("tells her the transcript is readable, which is what makes waiting fair", () => {
    assert.match(VOICE_MODE_RULES, /read the transcript/);
  });

  it("asks for spoken numbers, since she is hearing this", () => {
    assert.match(VOICE_MODE_RULES, /the way a person says them out loud/);
  });
});
