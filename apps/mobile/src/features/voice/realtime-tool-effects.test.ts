import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendUniqueVoiceToolEffects,
  messagesFromVoiceToolEffects,
  openingResponseCreateEvent,
  parseVoiceToolBridgeOutput,
  spokenReplyResponseCreateEvent,
} from "./realtime-tool-effects";

describe("native voice tool effects", () => {
  const effect = {
    callId: "planner-1",
    toolName: "open_planner",
    output: { opened: true },
  };

  it("accepts the typed bridge response and rejects malformed effects", () => {
    assert.deepEqual(
      parseVoiceToolBridgeOutput({
        ok: true,
        spokenReply: "Your planner is open.",
        effects: [effect],
        sessionState: {
          sessionId: "eve-1",
          continuationToken: "continue-1",
          streamIndex: 5,
        },
      }),
      {
        ok: true,
        spokenReply: "Your planner is open.",
        effects: [effect],
        sessionState: {
          sessionId: "eve-1",
          continuationToken: "continue-1",
          streamIndex: 5,
        },
      },
    );
    assert.equal(
      parseVoiceToolBridgeOutput({
        ok: true,
        spokenReply: "Done",
        effects: [{ toolName: "open_planner" }],
      }),
      null,
    );
  });

  it("turns authored effects into overlay-compatible Eve messages", () => {
    const messages = messagesFromVoiceToolEffects([effect]);
    assert.deepEqual(messages, [
      {
        id: "voice-tool:planner-1",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolCallId: "planner-1",
            toolName: "open_planner",
            state: "output-available",
            input: {},
            output: { opened: true },
          },
        ],
      },
    ]);
  });

  it("deduplicates a replayed realtime function result", () => {
    const current = [effect];
    assert.equal(appendUniqueVoiceToolEffects(current, [effect]), current);
    assert.equal(
      appendUniqueVoiceToolEffects(current, [
        { callId: "hours-1", toolName: "log_hours", output: { logged: true } },
      ]).length,
      2,
    );
  });

  it("locks the post-tool response to the full agent's spoken reply", () => {
    assert.deepEqual(spokenReplyResponseCreateEvent(), {
      type: "response.create",
      response: {
        instructions:
          "The immediately preceding function output is final. Read only its spokenReply value, exactly once. Do not add, omit, summarize, explain, or paraphrase anything.",
        tools: [],
        tool_choice: "none",
      },
    });
  });

  it("opens a new realtime conversation with one server-authored response", () => {
    assert.deepEqual(openingResponseCreateEvent(), {
      type: "response.create",
    });
  });
});
