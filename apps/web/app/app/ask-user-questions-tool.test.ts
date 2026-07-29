import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessagePart } from "eve/react";

import askUserQuestionsDynamic from "../../agent/tools/ask_user_questions";
import { parseQuestionCardPart } from "./question-card";

/**
 * The choice card is web only (founder ruling 2026-07-21): the
 * one-question-at-a-time rule came from SMS, where a stack of questions
 * is a burden and no card can render. The gate is structural, so these
 * tests assert the tool simply does not exist on those channels rather
 * than that it refuses politely.
 */

interface ResolveContext {
  channel: { kind?: string; metadata?: Record<string, unknown> };
  session: { auth: { current?: { attributes?: Record<string, unknown> } } };
}

type ResolvedTool = {
  description: string;
  execute(input: unknown, ctx: unknown): Promise<Record<string, unknown>>;
} | null;

function resolveForTurn(context: ResolveContext): ResolvedTool {
  const sentinel = askUserQuestionsDynamic as unknown as {
    events: Record<string, (event: unknown, ctx: ResolveContext) => ResolvedTool>;
  };
  // step.started, not turn.started: a turn-scoped dynamic tool is replayed
  // on later steps through a globalThis step registry this repo's tools
  // never populate, so it vanishes on any step served by a cold isolate
  // (gh#345). scripts/dynamic-tool-events-check.mts is the fleet guard.
  assert.equal(
    typeof sentinel.events["turn.started"],
    "undefined",
    "resolving on turn.started makes this tool vanish mid-conversation",
  );
  return sentinel.events["step.started"](null, context);
}

function contextFor(
  channel: string | undefined,
  overrides: Partial<ResolveContext["channel"]> = {},
): ResolveContext {
  return {
    channel: { kind: "channel:http", metadata: {}, ...overrides },
    session: {
      auth: {
        current: { attributes: channel === undefined ? {} : { channel } },
      },
    },
  };
}

describe("ask_user_questions channel gate", () => {
  it("exists on web chat", () => {
    assert.notEqual(resolveForTurn(contextFor("web")), null);
  });

  it("is absent when the telnyx adapter stamped the turn", () => {
    assert.equal(
      resolveForTurn(contextFor("web", { metadata: { adapterName: "telnyx" } })),
      null,
    );
  });

  it("is absent on the telnyx channel kind, with no adapter metadata", () => {
    assert.equal(
      resolveForTurn(contextFor(undefined, { kind: "channel:telnyx", metadata: {} })),
      null,
    );
  });

  for (const channel of ["sms", "email", "dispatch", "agent-job"]) {
    it(`is absent on ${channel}`, () => {
      assert.equal(resolveForTurn(contextFor(channel)), null);
    });
  }

  it("exists when no channel attribute is present, so the app keeps it", () => {
    assert.notEqual(resolveForTurn(contextFor(undefined)), null);
  });
});

describe("ask_user_questions output feeds the card", () => {
  it("produces a payload the transcript parser reads back", async () => {
    const tool = resolveForTurn(contextFor("web"));
    assert.notEqual(tool, null);
    const output = await tool!.execute(
      {
        questions: [
          {
            header: "Subject",
            question: "Where should we start with Maya?",
            options: [
              { label: "Phonics", description: "Short daily sound drills." },
              { label: "Reading aloud" },
            ],
          },
        ],
      },
      {},
    );

    // The real tool result, through the real transcript parser: this is
    // the seam where a backend rename would silently blank the card.
    const card = parseQuestionCardPart({
      type: "dynamic-tool",
      toolName: "ask_user_questions",
      state: "output-available",
      output,
    } as unknown as EveMessagePart);

    assert.equal(card?.questions.length, 1);
    assert.equal(card?.questions[0].header, "Subject");
    assert.equal(card?.questions[0].multiSelect, false);
    assert.equal(card?.questions[0].options[0].description, "Short daily sound drills.");
    assert.equal(card?.questions[0].options[1].description, null);
  });
});
