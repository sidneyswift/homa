import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { EveMessage } from "eve/react";

import { busyLabel, MessageView } from "./message-parts";

const CHECK_IN_ID = "11111111-1111-4111-8111-111111111111";
const CHECK_IN_ID_TWO = "22222222-2222-4222-8222-222222222222";
const UNDO_TOKEN = "33333333-3333-4333-8333-333333333333";

function assistantMessage(parts: unknown[]): EveMessage {
  return {
    id: "turn_1:assistant",
    role: "assistant",
    parts,
  } as unknown as EveMessage;
}

function progressPart(output: unknown, state = "output-available") {
  return {
    type: "dynamic-tool",
    state,
    toolName: "manage_child_progress",
    output,
  };
}

function assertOrdered(html: string, labels: readonly string[]): void {
  let previous = -1;
  for (const label of labels) {
    const index = html.indexOf(label);
    assert.ok(index > previous, `Expected "${label}" after the prior item`);
    previous = index;
  }
}

describe("MessageView progress parts", () => {
  it("renders progress cards in source order with text, memory, and material parts", () => {
    const message = assistantMessage([
      { type: "text", text: "First response" },
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "remember",
        output: { saved: true, content: "A calm family note" },
      },
      progressPart({
        kind: "progress_update",
        label: "Progress updated",
        childName: "Maya",
        affectedTopics: ["Counts out loud from 1 to 5"],
        undoAvailable: true,
        undoToken: UNDO_TOKEN,
      }),
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "create_printable",
        output: {
          material: {
            title: "Counting practice",
            kind: "worksheet",
            skill: "Counting",
            childName: "Maya",
            previewUrl: "https://example.com/counting.jpg",
            pdfUrl: "https://example.com/counting.pdf",
          },
        },
      },
      progressPart({
        kind: "progress_question",
        prompt: {
          checkInId: CHECK_IN_ID,
          revision: 2,
          childName: "Maya",
          subjectDisplayName: "Math",
          statement: "Can Maya count out loud from 1 to 5?",
          answerOptions: [
            "easily",
            "getting_there",
            "not_yet",
            "not_sure",
            "skip",
          ],
        },
      }),
      { type: "text", text: "Last response" },
    ]);

    const html = renderToStaticMarkup(
      <MessageView
        message={message}
        timeZone="America/Los_Angeles"
        onSendSuggestion={() => {}}
        onFocusComposer={() => {}}
      />,
    );

    assertOrdered(html, [
      "First response",
      "Noted",
      "Progress updated",
      "Worksheet ready",
      "Can Maya count out loud from 1 to 5?",
      "Last response",
    ]);
    assert.doesNotMatch(html, new RegExp(UNDO_TOKEN, "u"));
  });

  it("renders workflow updates before the quiet workflow chip", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([
          progressPart({
            kind: "progress_workflow",
            label: "Check-in saved",
            update: {
              label: "Progress updated",
              undoToken: UNDO_TOKEN,
              affectedTopics: ["Counts out loud from 1 to 5"],
            },
          }),
        ])}
      />,
    );

    assertOrdered(html, ["Progress updated", "Check-in saved"]);
    assert.match(html, /disabled/u);
  });

  it("ignores malformed progress output without hiding later transcript text", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([
          progressPart({
            kind: "progress_update",
            label: "Progress updated",
            childName: "Maya",
            affectedTopics: [],
            undoAvailable: true,
            undoToken: "not-a-uuid",
          }),
          { type: "text", text: "This still renders" },
        ])}
      />,
    );

    assert.match(html, /This still renders/u);
    assert.doesNotMatch(html, /Progress updated/u);
  });

  it("enables handlers only for the exact actionable part in one message", () => {
    const firstStatement = "Can Maya count to 5?";
    const secondStatement = "Can Maya count to 10?";
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([
          progressPart({
            kind: "progress_question",
            prompt: {
              checkInId: CHECK_IN_ID,
              revision: 1,
              childName: "Maya",
              subjectDisplayName: "Math",
              statement: firstStatement,
              answerOptions: [
                "easily",
                "getting_there",
                "not_yet",
                "not_sure",
                "skip",
              ],
            },
          }),
          progressPart({
            kind: "progress_question",
            prompt: {
              checkInId: CHECK_IN_ID_TWO,
              revision: 2,
              childName: "Maya",
              subjectDisplayName: "Math",
              statement: secondStatement,
              answerOptions: [
                "easily",
                "getting_there",
                "not_yet",
                "not_sure",
                "skip",
              ],
            },
          }),
        ])}
        actionableProgressPartKey="turn_1:assistant:1"
        onSendSuggestion={() => {}}
        onFocusComposer={() => {}}
      />,
    );
    const firstStart = html.indexOf(firstStatement);
    const secondStart = html.indexOf(secondStatement);
    assert.ok(firstStart >= 0 && secondStart > firstStart);
    const firstCard = html.slice(firstStart, secondStart);
    const secondCard = html.slice(secondStart);

    // The stale card reads as settled text (chat redesign 2026-07-13:
    // a spent button must never look pressable); only the actionable
    // card offers live answer buttons.
    assert.doesNotMatch(firstCard, /<button/u);
    assert.match(firstCard, /Easily · Getting there/u);
    assert.match(secondCard, /<button/u);
    assert.doesNotMatch(secondCard, / disabled=""/u);
    assert.doesNotMatch(html, /turn_1:assistant:1/u);
  });
});

describe("busyLabel progress status", () => {
  it("names an in-flight manage_child_progress tool", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          progressPart(undefined, "input-available"),
        ]),
      ]),
      "updating progress…",
    );
  });
});

describe("busyLabel material build phases", () => {
  const materialsSkillPart = {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "load_skill",
    input: { skill: "materials-studio" },
    output: "the studio skill text",
  };

  function printablePart(output: unknown) {
    return {
      type: "dynamic-tool",
      state: "output-available",
      toolName: "create_printable",
      output,
    };
  }

  it("keeps plain thinking for reasoning with no build in flight", () => {
    assert.equal(
      busyLabel([
        assistantMessage([{ type: "reasoning", state: "streaming", text: "hm" }]),
      ]),
      "thinking…",
    );
  });

  it("names the design phase once the materials skill is loaded", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          materialsSkillPart,
          { type: "reasoning", state: "streaming", text: "layout ideas" },
        ]),
      ]),
      "designing the page…",
    );
  });

  it("moves forward to writing once a generated image is in hand", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          {
            type: "dynamic-tool",
            state: "output-available",
            toolName: "generate_image",
            output: { generated: true, url: "https://example.com/pup.png" },
          },
        ]),
      ]),
      "writing the page…",
    );
  });

  it("stays in the design phase when image generation was refused", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          {
            type: "dynamic-tool",
            state: "output-available",
            toolName: "generate_image",
            output: { generated: false, note: "budget used up" },
          },
        ]),
      ]),
      "designing the page…",
    );
  });

  it("says almost done after a passing page, even under a finished interim sentence", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          materialsSkillPart,
          printablePart({ created: true, review: { pass: true, issues: [] } }),
          { type: "text", state: "done", text: "Here it comes." },
        ]),
      ]),
      "almost done…",
    );
  });

  it("says fixing a detail when the quality check flagged the page", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          printablePart({ created: true, review: { pass: false, issues: ["title typo"] } }),
          { type: "reasoning", state: "streaming", text: "fix the title" },
        ]),
      ]),
      "fixing a detail…",
    );
  });

  it("reads as fixing when a create attempt was refused, never a step backwards", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          materialsSkillPart,
          printablePart({ created: false, note: "Provide exactly one of html or pageImageUrl." }),
        ]),
      ]),
      "fixing a detail…",
    );
  });

  it("stays quiet while interim text is still streaming", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          materialsSkillPart,
          { type: "text", state: "streaming", text: "On it. Skye's page" },
        ]),
      ]),
      null,
    );
  });

  it("lets an executing studio tool keep its own label", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          materialsSkillPart,
          {
            type: "dynamic-tool",
            state: "input-streaming",
            toolName: "create_printable",
            input: undefined,
          },
        ]),
      ]),
      "putting the page together…",
    );
  });

  it("keeps the fixing label while a flagged page is being redone", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          printablePart({ created: true, review: { pass: false, issues: ["title typo"] } }),
          {
            type: "dynamic-tool",
            state: "input-streaming",
            toolName: "create_printable",
            input: undefined,
          },
        ]),
      ]),
      "fixing a detail…",
    );
  });

  it("uses the normal label for a second page after a clean first one", () => {
    assert.equal(
      busyLabel([
        assistantMessage([
          printablePart({ created: true, review: { pass: true, issues: [] } }),
          {
            type: "dynamic-tool",
            state: "input-streaming",
            toolName: "create_printable",
            input: undefined,
          },
        ]),
      ]),
      "putting the page together…",
    );
  });
});
