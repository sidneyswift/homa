import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRealtimeInstructions,
  composeRealtimeInstructions,
  VOICE_MODE_RULES,
} from "./realtime-session";
import { VOICE_PERSONA_MARKDOWN } from "./persona.generated";
import {
  realtimeToolDefinitions,
  runVoiceTool,
  VOICE_TOOL_BOUNDARY_LINES,
  VOICE_TOOLS,
  type VoiceToolName,
} from "./realtime-tools";

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
  // The mechanism, not the wording. general-call-instructions.md opens with
  // "You have exactly four tools" as hand-written prose, so the moment the
  // phone's tool set changed that sentence became a lie in the one file
  // whose job was preventing lies. Here the can-do list is derived, so a
  // tool added without a line fails right here instead of shipping
  // unmentioned.
  it("has a spoken line for every allowlisted tool", () => {
    for (const name of Object.keys(VOICE_TOOLS) as VoiceToolName[]) {
      assert.ok(
        VOICE_TOOL_BOUNDARY_LINES[name],
        `${name} is callable but Homa is never told she can do it`,
      );
    }
  });

  it("has no line for a tool that is not allowlisted", () => {
    for (const name of Object.keys(VOICE_TOOL_BOUNDARY_LINES)) {
      assert.ok(
        Object.hasOwn(VOICE_TOOLS, name),
        `${name} is described to Homa but she cannot call it`,
      );
    }
  });

  it("says out loud what it can do", () => {
    for (const line of Object.values(VOICE_TOOL_BOUNDARY_LINES)) {
      assert.ok(VOICE_MODE_RULES.includes(line), `boundary is missing: ${line}`);
    }
  });

  it("closes the can-do list so nothing is assumed beyond it", () => {
    assert.match(VOICE_MODE_RULES, /That is the whole list/);
  });

  // The 2026-07-19 call claimed a worksheet was emailed and filed in the
  // binder. None of those is on the allowlist, so each is named.
  for (const forbidden of ["worksheet", "binder", "calendar", "planner", "send an email"]) {
    it(`still names ${forbidden} as something it cannot do`, () => {
      assert.ok(
        VOICE_MODE_RULES.toLowerCase().includes(forbidden.toLowerCase()),
        `boundary must mention ${forbidden}`,
      );
    });
  }

  it("states the honesty law in terms of tool results, now that tools exist", () => {
    assert.match(VOICE_MODE_RULES, /A tool result is the only truth/);
  });

  it("asks for a spoken preamble, since a lookup is silence otherwise", () => {
    assert.match(VOICE_MODE_RULES, /"Let me look" is a real sentence/);
  });

  it("gives a real path out rather than only a refusal", () => {
    assert.match(VOICE_MODE_RULES, /this whole conversation is in\s+> your chat/);
  });
});

describe("the voice tool surface", () => {
  it("derives definitions from the tools' own zod schemas", () => {
    const defs = realtimeToolDefinitions();
    assert.equal(defs.length, Object.keys(VOICE_TOOLS).length);
    for (const def of defs) {
      assert.equal(def.type, "function");
      assert.ok(def.description.length > 0, `${def.name} has no description`);
      assert.equal(typeof def.parameters, "object");
    }
  });

  it("carries no tool that can make or send anything", () => {
    const names = Object.keys(VOICE_TOOLS);
    for (const forbidden of [
      "create_printable",
      "generate_image",
      "send_followup_email",
      "mark_material_final",
      "edit_plan",
    ]) {
      assert.ok(!names.includes(forbidden), `${forbidden} must not be callable by voice`);
    }
  });

  // Dispatch is a lookup in the allowlist and nothing else, so a model
  // asking for a real eve tool that is not on the list gets refused rather
  // than executed.
  it("refuses a tool that exists in eve but is not allowlisted", async () => {
    const outcome = await runVoiceTool({
      name: "create_printable",
      args: {},
      identity: {
        familyId: "11111111-1111-1111-1111-111111111111",
        memberUserId: "22222222-2222-2222-2222-222222222222",
        supabaseAccessToken: "unused",
        sessionId: "test",
      },
    });
    assert.equal(outcome.ok, false);
    assert.match(JSON.stringify(outcome.output), /not something I can do/);
  });

  it("refuses a name that is not a tool at all", async () => {
    const outcome = await runVoiceTool({
      name: "__proto__",
      args: {},
      identity: {
        familyId: "11111111-1111-1111-1111-111111111111",
        memberUserId: "22222222-2222-2222-2222-222222222222",
        supabaseAccessToken: "unused",
        sessionId: "test",
      },
    });
    assert.equal(outcome.ok, false);
  });
});
