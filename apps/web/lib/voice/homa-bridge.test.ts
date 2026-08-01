import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HandleMessageStreamEvent } from "eve/client";

import {
  askHomaFromVoice,
  parseVoiceHomaSessionState,
  voiceHomaEffects,
  type VoiceHomaTurnRunner,
} from "./homa-bridge";

function toolResult(
  input: {
    callId: string;
    toolName: string;
    output: unknown;
    isError?: boolean;
    status?: "completed" | "failed";
  },
): HandleMessageStreamEvent {
  return {
    type: "action.result",
    data: {
      result: {
        kind: "tool-result",
        callId: input.callId,
        toolName: input.toolName,
        output: input.output,
        isError: input.isError,
      },
      sequence: 1,
      stepIndex: 0,
      status: input.status ?? "completed",
      turnId: "turn-1",
    },
  } as HandleMessageStreamEvent;
}

describe("voice Homa bridge", () => {
  it("projects completed authored tool effects only", () => {
    const events = [
      toolResult({ callId: "a", toolName: "open_planner", output: { opened: true } }),
      toolResult({ callId: "b", toolName: "create_printable", output: {}, isError: true }),
      toolResult({
        callId: "c",
        toolName: "remember",
        output: { saved: true },
        status: "failed",
      }),
      {
        type: "action.result",
        data: {
          result: {
            kind: "load-skill-result",
            callId: "d",
            output: { loaded: true },
          },
          sequence: 2,
          stepIndex: 0,
          status: "completed",
          turnId: "turn-1",
        },
      } as HandleMessageStreamEvent,
    ];
    assert.deepEqual(voiceHomaEffects(events), [
      {
        callId: "a",
        toolName: "open_planner",
        output: { opened: true },
      },
    ]);
  });

  it("returns the full agent reply and effects without rewriting either", async () => {
    let receivedMessage = "";
    const runner: VoiceHomaTurnRunner = {
      async run(input) {
        receivedMessage = input.message;
        return {
          status: "completed",
          message: "Your printable is on the screen.",
          events: [
            toolResult({
              callId: "print-1",
              toolName: "create_printable",
              output: { material: { previewUrl: "https://example.test/page" } },
            }),
          ],
          sessionId: "eve-1",
          sessionState: {
            sessionId: "eve-1",
            continuationToken: "continue-1",
            streamIndex: 9,
          },
        };
      },
    };
    const output = await askHomaFromVoice(
      {
        host: "https://example.test",
        accessToken: "token",
        message: "  Make Maya a printable  ",
        sourceMessageId: "11111111-1111-4111-8111-111111111111",
      },
      runner,
    );
    assert.equal(receivedMessage, "Make Maya a printable");
    assert.equal(output.spokenReply, "Your printable is on the screen.");
    assert.equal(output.effects[0]?.toolName, "create_printable");
    assert.equal(output.sessionId, "eve-1");
    assert.equal(output.sessionState?.continuationToken, "continue-1");
    assert.equal(output.ok, true);
  });

  it("accepts only bounded Eve continuation state", () => {
    assert.deepEqual(
      parseVoiceHomaSessionState({
        sessionId: "eve-1",
        continuationToken: "continue-1",
        streamIndex: 9,
      }),
      {
        sessionId: "eve-1",
        continuationToken: "continue-1",
        streamIndex: 9,
      },
    );
    assert.equal(parseVoiceHomaSessionState({ streamIndex: -1 }), undefined);
    assert.equal(parseVoiceHomaSessionState({ streamIndex: "9" }), undefined);
  });

  it("fails honestly without inventing an effect", async () => {
    const runner: VoiceHomaTurnRunner = {
      async run() {
        throw new Error("offline");
      },
    };
    const output = await askHomaFromVoice(
      {
        host: "https://example.test",
        accessToken: "token",
        message: "Do it",
        sourceMessageId: "11111111-1111-4111-8111-111111111111",
      },
      runner,
    );
    assert.equal(output.ok, false);
    assert.deepEqual(output.effects, []);
    assert.match(output.spokenReply, /Nothing changed/u);
  });
});
