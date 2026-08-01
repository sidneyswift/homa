import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openai } from "@ai-sdk/openai";

import {
  buildRealtimeAudioProviderOptions,
  buildRealtimeInstructions,
  composeRealtimeInstructions,
  voiceSpeakerName,
  VOICE_MODE_RULES,
} from "./realtime-session";
import { VOICE_PERSONA_MARKDOWN } from "./persona.generated";
import {
  ASK_HOMA_TOOL_NAME,
  parseAskHomaInput,
  realtimeToolDefinitions,
} from "./realtime-tools";

describe("realtime voice instructions", () => {
  it("puts the persona first, then voice rules, then the family", () => {
    const out = composeRealtimeInstructions({
      persona: "PERSONA",
      familyContext: "FAMILY",
    });
    assert.ok(out.indexOf("PERSONA") < out.indexOf("talking out loud"));
    assert.ok(out.indexOf("talking out loud") < out.indexOf("FAMILY"));
  });

  it("omits a missing family block without failing the session", () => {
    const out = composeRealtimeInstructions({ persona: "PERSONA", familyContext: "" });
    assert.ok(out.startsWith("PERSONA"));
    assert.ok(!out.endsWith("\n\n"));
  });

  it("carries the real persona without web tool operations", () => {
    const out = buildRealtimeInstructions("");
    assert.ok(out.includes("You are Homa"));
    assert.ok(VOICE_PERSONA_MARKDOWN.length > 500);
    assert.ok(!VOICE_PERSONA_MARKDOWN.includes("## What you know each turn"));
  });

  it("opens the conversation itself with a varied, personal question", () => {
    assert.match(VOICE_MODE_RULES, /Open the conversation yourself/u);
    assert.match(VOICE_MODE_RULES, /first name/u);
    assert.match(VOICE_MODE_RULES, /Vary the wording naturally/u);
    assert.match(VOICE_MODE_RULES, /Never guess/u);
  });

  it("selects only the authenticated adult's own name", () => {
    const members = [
      { user_id: "adult-a", display_name: "Elena Rivera" },
      { user_id: "adult-b", display_name: "Jordan Rivera" },
    ];
    assert.equal(voiceSpeakerName(members, "adult-b"), "Jordan Rivera");
    assert.equal(voiceSpeakerName(members, "adult-c"), null);
  });
});

describe("realtime voice interruption policy", () => {
  it("lets the parent interrupt through filtered, thresholded speech detection", () => {
    const mapped = openai.experimental_realtime("gpt-realtime-2.1").buildSessionConfig({
      providerOptions: buildRealtimeAudioProviderOptions("marin"),
    }) as { audio?: unknown };

    assert.deepEqual(mapped.audio, {
      input: {
        transcription: { model: "gpt-realtime-whisper" },
        noise_reduction: { type: "far_field" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.65,
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice: "marin" },
    });
  });
});

describe("the full Homa voice bridge", () => {
  it("offers exactly one typed delegation tool", () => {
    const definitions = realtimeToolDefinitions();
    assert.equal(definitions.length, 1);
    assert.equal(definitions[0]?.name, ASK_HOMA_TOOL_NAME);
    assert.equal(definitions[0]?.type, "function");
    assert.equal(typeof definitions[0]?.parameters, "object");
  });

  it("preserves a bounded parent request", () => {
    assert.deepEqual(parseAskHomaInput({ request: "  Make Maya a maze  " }), {
      request: "Make Maya a maze",
    });
    assert.equal(parseAskHomaInput({ request: "" }), null);
    assert.equal(parseAskHomaInput({ request: "x".repeat(8_001) }), null);
  });

  for (const capability of [
    "printables",
    "binder",
    "planner",
    "calendar",
    "tasks",
    "hours",
    "child progress",
    "curriculum",
    "follow-up delivery",
  ]) {
    it(`routes ${capability} through the full agent`, () => {
      assert.ok(VOICE_MODE_RULES.includes(capability));
    });
  }

  it("uses the bridge result as the exact spoken response", () => {
    assert.match(VOICE_MODE_RULES, /spokenReply is your complete next response/u);
    assert.match(VOICE_MODE_RULES, /Do not add to it, omit from it, summarize it, or paraphrase it/u);
  });

  it("does not retain the retired voice-only refusals", () => {
    assert.doesNotMatch(VOICE_MODE_RULES, /Anything else has to wait for chat/u);
    assert.doesNotMatch(VOICE_MODE_RULES, /cannot do in this conversation/u);
    assert.match(VOICE_MODE_RULES, /Voice is not a smaller product surface/u);
  });

  it("keeps completion claims behind real results", () => {
    assert.match(VOICE_MODE_RULES, /only truth about whether something happened/u);
  });

  it("routes references to the visible object through the authenticated agent", () => {
    assert.match(VOICE_MODE_RULES, /this, that, the visible/u);
    assert.match(VOICE_MODE_RULES, /exact object is still visible and safe/u);
  });
});
