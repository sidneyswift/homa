import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendPreparedChatSendToQueue,
  flushChatQueue,
  focusChatComposerInput,
  prepareChatSend,
} from "./chat-send-policy";
import { formatHiddenDirective } from "../../lib/onboarding/directives";

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
        lane: "parent",
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

  it("routes a machine directive into its own lane, untouched by her draft", () => {
    const plan = prepareChatSend({
      text: formatHiddenDirective("kickoff"),
      busy: false,
      draftFromVoice: true,
      source: { kind: "directive" },
    });

    assert.equal(plan?.lane, "directive");
    assert.equal(plan?.modality, "text");
    assert.equal(plan?.clearDraft, false);
    assert.equal(plan?.resetDraftFromVoice, false);
  });

  it("recognizes a marker by its grammar even when the caller mislabels the source", () => {
    const plan = prepareChatSend({
      text: formatHiddenDirective("resume"),
      busy: false,
      draftFromVoice: false,
      source: { kind: "composer" },
    });

    assert.equal(plan?.lane, "directive");
  });

  it("queues a repeated directive only once", () => {
    const plan = prepareChatSend({
      text: formatHiddenDirective("kickoff"),
      busy: true,
      draftFromVoice: false,
      source: { kind: "directive" },
    });
    assert.ok(plan);

    const first = appendPreparedChatSendToQueue([], plan);
    const repeated = appendPreparedChatSendToQueue(first, plan);

    assert.equal(first.length, 1);
    assert.equal(repeated, first);
  });
});

describe("flushChatQueue", () => {
  const parent = (text: string) =>
    ({ text, progressActionKey: null, lane: "parent" }) as const;
  const directive = (text: string) =>
    ({ text, progressActionKey: null, lane: "directive" }) as const;

  it("says nothing when there is nothing queued", () => {
    assert.deepEqual(flushChatQueue([]), {
      outgoing: null,
      remaining: [],
      lane: "parent",
    });
  });

  it("joins her queued words with the message she just sent, as before", () => {
    assert.deepEqual(
      flushChatQueue([parent("Mia is six"), parent("Leo is four")], {
        text: "and we start Monday",
        lane: "parent",
      }),
      {
        outgoing: "Mia is six\n\nLeo is four\n\nand we start Monday",
        remaining: [],
        lane: "parent",
      },
    );
  });

  it("sends a queued directive alone and holds her words for the next line", () => {
    const marker = formatHiddenDirective("checklist_complete", {
      childId: "abc",
      answered: 41,
    });
    assert.deepEqual(
      flushChatQueue([directive(marker)], { text: "that was quick", lane: "parent" }),
      {
        outgoing: marker,
        remaining: [parent("that was quick")],
        lane: "directive",
      },
    );
  });

  it("never joins a directive onto the end of her words either", () => {
    const marker = formatHiddenDirective("resume");
    assert.deepEqual(
      flushChatQueue([parent("hi again")], { text: marker, lane: "directive" }),
      {
        outgoing: "hi again",
        remaining: [directive(marker)],
        lane: "parent",
      },
    );
  });

  it("sends one directive per flush, in the order the events happened", () => {
    const first = formatHiddenDirective("checklist_complete", { childId: "abc" });
    const second = formatHiddenDirective("panel_opened", { panel: "planner" });
    const round1 = flushChatQueue([directive(first), directive(second), parent("ok")]);
    assert.equal(round1.outgoing, first);
    const round2 = flushChatQueue(round1.remaining);
    assert.equal(round2.outgoing, second);
    const round3 = flushChatQueue(round2.remaining);
    assert.equal(round3.outgoing, "ok");
    assert.deepEqual(round3.remaining, []);
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
