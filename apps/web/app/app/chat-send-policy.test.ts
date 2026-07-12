import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendPreparedChatSendToQueue,
  focusChatComposerInput,
  prepareChatSend,
} from "./chat-send-policy";

describe("prepareChatSend", () => {
  it("queues a busy card action as text with its stable one-shot key", () => {
    assert.deepEqual(
      prepareChatSend({
        text: "Getting there",
        busy: true,
        draftFromVoice: true,
        source: {
          kind: "progress_card",
          progressActionKey:
            "progress-card:session-1:turn_1:assistant:0",
        },
      }),
      {
        message: "Getting there",
        destination: "queue",
        modality: "text",
        clearDraft: false,
        resetDraftFromVoice: false,
        progressActionKey:
          "progress-card:session-1:turn_1:assistant:0",
      },
    );
  });

  it("preserves the composer draft and dictation marker for an idle card action", () => {
    const plan = prepareChatSend({
      text: "Undo that progress update.",
      busy: false,
      draftFromVoice: true,
      source: {
        kind: "progress_card",
        progressActionKey:
          "progress-card:session-1:turn_1:assistant:0",
      },
    });

    assert.equal(plan?.destination, "send");
    assert.equal(plan?.clearDraft, false);
    assert.equal(plan?.resetDraftFromVoice, false);
    assert.equal(plan?.modality, "text");
  });

  it("keeps normal dictated composer-send behavior unchanged", () => {
    const plan = prepareChatSend({
      text: "Here is our day",
      busy: false,
      draftFromVoice: true,
      source: { kind: "composer" },
    });

    assert.equal(plan?.destination, "send");
    assert.equal(plan?.clearDraft, true);
    assert.equal(plan?.resetDraftFromVoice, true);
    assert.equal(plan?.modality, "voice");
    assert.equal(plan?.progressActionKey, null);
  });

  it("queues a repeated one-shot card action only once", () => {
    const plan = prepareChatSend({
      text: "Getting there",
      busy: true,
      draftFromVoice: false,
      source: {
        kind: "progress_card",
        progressActionKey:
          "progress-card:session-1:turn_1:assistant:0",
      },
    });
    assert.ok(plan);

    const first = appendPreparedChatSendToQueue([], plan);
    const repeated = appendPreparedChatSendToQueue(first, plan);

    assert.equal(first.length, 1);
    assert.equal(
      first[0]?.progressActionKey,
      "progress-card:session-1:turn_1:assistant:0",
    );
    assert.equal(repeated.length, 1);
    assert.equal(repeated, first);
  });
});

describe("focusChatComposerInput", () => {
  it("focuses the real composer input selected from the form", () => {
    let selected = "";
    let focusCount = 0;
    focusChatComposerInput({
      querySelector(selector) {
        selected = selector;
        return {
          focus() {
            focusCount += 1;
          },
        };
      },
    });

    assert.equal(selected, "input");
    assert.equal(focusCount, 1);
  });
});
