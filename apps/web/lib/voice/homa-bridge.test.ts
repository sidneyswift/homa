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
    meta: { at: "2026-09-13T00:00:00.000Z", ...{ id: `fixture-${input.callId}` } },
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
        meta: { at: "2026-09-13T00:00:00.000Z", ...{ id: "fixture-skill-load" } },
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
    assert.equal(output.needsReply, false);
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
    assert.match(output.spokenReply, /could not confirm/u);
    assert.doesNotMatch(output.spokenReply, /Nothing changed/u);
  });

  for (const scenario of [
    { name: "a read result", status: "completed", effects: [toolResult({ callId: "read", toolName: "get_hours", output: { entries: [] } })] },
    { name: "an unsuccessful write", status: "completed", effects: [toolResult({ callId: "log", toolName: "log_hours", output: { logged: false } })] },
    { name: "an unrendered waiting state", status: "waiting", effects: [] },
    { name: "a failure after a saved effect", status: "failed", effects: [toolResult({ callId: "log", toolName: "log_hours", output: { logged: true } })] },
  ] as const) {
    it(`does not invent visible success or rollback for ${scenario.name}`, async () => {
      const result = await askHomaFromVoice({
        host: "https://example.test", accessToken: "token", message: "Please help",
        sourceMessageId: "11111111-1111-4111-8111-111111111111",
      }, {
        async run() {
          return { status: scenario.status, message: undefined,
            events: [...scenario.effects], sessionId: "eve-one", sessionState: { streamIndex: 1 } };
        },
      });
      assert.doesNotMatch(result.spokenReply, /Done\.|on the screen|Nothing changed/u);
      assert.equal(result.needsReply, scenario.status === "waiting");
      if (scenario.status === "failed") assert.equal(result.effects.length, 1);
    });
  }

  it("reads the actual question when the agent returned a question card without prose", async () => {
    const result = await askHomaFromVoice({
      host: "https://example.test", accessToken: "token", message: "Make it",
      sourceMessageId: "11111111-1111-4111-8111-111111111111",
    }, {
      async run() {
        return { status: "completed", message: undefined,
          events: [toolResult({ callId: "question", toolName: "ask_user_questions", output: {
            asked: true, questions: [{ question: "Which child is this for?" }],
          } })], sessionId: "eve-one", sessionState: { streamIndex: 1 } };
      },
    });
    assert.equal(result.spokenReply, "Which child is this for?");
    assert.equal(result.needsReply, true);
  });
});

it("failed question effects do not request another parent answer", async () => {
  for (const status of ["completed", "failed"] as const) {
    const result = await askHomaFromVoice({
      host: "https://example.test", accessToken: "token", message: "Make it",
      sourceMessageId: "11111111-1111-4111-8111-111111111111",
    }, {
      async run() {
        return { status, message: "That step failed.", events: [toolResult({
          callId: "question", toolName: "ask_user_questions", output: { asked: false, questions: [] },
        })], sessionId: "eve-one", sessionState: { streamIndex: 1 } };
      },
    });
    assert.equal(result.needsReply, false);
  }
});
