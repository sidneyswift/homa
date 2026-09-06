import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chatSendHeaders,
  composerPrimaryAction,
  appendPreparedChatSendToQueue,
  flushChatQueue,
  focusChatComposerInput,
  isSendLineOccupied,
  prepareAttachmentChatTurn,
  prepareChatSend,
} from "./chat-send-policy";
import { formatHiddenDirective } from "../../lib/onboarding/directives";
import { HOMA_MESSAGE_SOURCE_HEADER } from "../../lib/chat-message-source";
import { HOMA_MESSAGE_MODALITY_HEADER } from "../../lib/web-message-modality";
import { VOICE_TRANSCRIPTION_MARKER } from "../../lib/voice/transcription-marker";
import { ASSESSMENT_ACTION_HEADER } from "../../lib/child-progress/assessment-intent";

describe("selected assessment queue identity", () => {
  const assessmentAction = {requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", childId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", subjectId: "music"};
  it("keeps the typed action separate from drafts, saved answers, and another selected action", () => {
    const first = prepareChatSend({text: "Ask me deeper music questions for Maya.", busy: true, draftFromVoice: true, source: {kind: "assessment_action", assessmentAction}});
    assert.ok(first);
    assert.equal(first.clearDraft, false);
    assert.equal(first.modality, "text");
    const queue = appendPreparedChatSendToQueue([], first);
    assert.deepEqual(appendPreparedChatSendToQueue(queue, first), queue);
    const flush = flushChatQueue(queue, {text: "My separate thought", lane: "parent", modality: "text"});
    assert.equal(flush.outgoing, first.message);
    assert.deepEqual(flush.assessmentAction, assessmentAction);
    assert.equal(flush.remaining[0].text, "My separate thought");
    assert.deepEqual(JSON.parse(chatSendHeaders(flush.modality, flush.lane, flush.assessmentAction)[ASSESSMENT_ACTION_HEADER]), assessmentAction);
    assert.equal(chatSendHeaders("text", "parent", assessmentAction)[ASSESSMENT_ACTION_HEADER], undefined);
    const another = prepareChatSend({text: "Ask me deeper art questions for Maya.", busy: true, draftFromVoice: false, source: {kind: "assessment_action", assessmentAction: {...assessmentAction, requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", subjectId: "art"}}});
    assert.ok(another);
    assert.equal(flushChatQueue(appendPreparedChatSendToQueue(queue, another)).remaining.length, 1);
  });
});

describe("chatSendHeaders", () => {
  it("carries saved-card provenance into the agent request", () => {
    assert.deepEqual(chatSendHeaders("text", "saved_card_answer"), {
      [HOMA_MESSAGE_MODALITY_HEADER]: "text",
      [HOMA_MESSAGE_SOURCE_HEADER]: "saved-card-answer",
    });
  });
});

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

  it("preserves a saved detail card as its own request source", () => {
    const plan = prepareChatSend({
      text: "Sidney, District of Columbia · Eclectic",
      busy: false,
      draftFromVoice: true,
      source: { kind: "card_answer" },
    });

    assert.equal(plan?.lane, "saved_card_answer");
    assert.equal(plan?.modality, "text");
    assert.equal(plan?.clearDraft, false);
  });

  it("adds durable provenance to a dictated composer send", () => {
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
    assert.equal(
      plan?.message,
      `${VOICE_TRANSCRIPTION_MARKER}: Here is our day`,
    );
    assert.equal(plan?.progressActionKey, null);
  });

  it("keeps a marked failed-send retry in the voice lane without nesting markers", () => {
    const marked = `${VOICE_TRANSCRIPTION_MARKER}: Here is our day`;
    const plan = prepareChatSend({
      text: marked,
      busy: false,
      draftFromVoice: false,
      source: { kind: "composer" },
    });

    assert.equal(plan?.modality, "voice");
    assert.equal(plan?.message, marked);
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
  const parent = (text: string, modality: "text" | "voice" = "text") =>
    ({ text, progressActionKey: null, lane: "parent", modality }) as const;
  const directive = (text: string) =>
    ({
      text,
      progressActionKey: null,
      lane: "directive",
      modality: "text",
    }) as const;
  const savedCardAnswer = (text: string) =>
    ({
      text,
      progressActionKey: null,
      lane: "saved_card_answer",
      modality: "text",
    }) as const;

  it("says nothing when there is nothing queued", () => {
    assert.deepEqual(flushChatQueue([]), {
      outgoing: null,
      remaining: [],
      lane: "parent",
      modality: "text",
    });
  });

  it("joins her queued words with the message she just sent, as before", () => {
    assert.deepEqual(
      flushChatQueue([parent("Mia is six"), parent("Leo is four")], {
        text: "and we start Monday",
        lane: "parent",
        modality: "text",
      }),
      {
        outgoing: "Mia is six\n\nLeo is four\n\nand we start Monday",
        remaining: [],
        lane: "parent",
        modality: "text",
      },
    );
  });

  it("keeps voice provenance when a dictated message waits beside typed words", () => {
    const flush = flushChatQueue(
      [
        parent(
          `${VOICE_TRANSCRIPTION_MARKER}: Mia finished the chapter`,
          "voice",
        ),
      ],
      { text: "and Leo drew the map", lane: "parent", modality: "text" },
    );

    assert.equal(flush.modality, "voice");
    assert.equal(
      flush.outgoing,
      `${VOICE_TRANSCRIPTION_MARKER}: Mia finished the chapter\n\nand Leo drew the map`,
    );
  });

  it("sends a saved card answer alone instead of merging its provenance with typed prose", () => {
    const first = flushChatQueue([
      savedCardAnswer("Sidney, District of Columbia · Eclectic"),
      parent("and I have a question"),
    ]);

    assert.equal(
      first.outgoing,
      "Sidney, District of Columbia · Eclectic",
    );
    assert.equal(first.lane, "saved_card_answer");
    assert.deepEqual(first.remaining, [parent("and I have a question")]);
    assert.equal(flushChatQueue(first.remaining).lane, "parent");
  });

  it("sends a queued directive alone and holds her words for the next line", () => {
    const marker = formatHiddenDirective("checklist_complete", {
      childId: "abc",
      answered: 41,
    });
    assert.deepEqual(
      flushChatQueue([directive(marker)], {
        text: "that was quick",
        lane: "parent",
        modality: "text",
      }),
      {
        outgoing: marker,
        remaining: [parent("that was quick")],
        lane: "directive",
        modality: "text",
      },
    );
  });

  it("never joins a directive onto the end of her words either", () => {
    const marker = formatHiddenDirective("resume");
    assert.deepEqual(
      flushChatQueue([parent("hi again")], {
        text: marker,
        lane: "directive",
        modality: "text",
      }),
      {
        outgoing: "hi again",
        remaining: [directive(marker)],
        lane: "parent",
        modality: "text",
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

describe("prepareAttachmentChatTurn", () => {
  it("marks only the dictated caption and keeps attachment provenance separate", () => {
    assert.deepEqual(
      prepareAttachmentChatTurn({
        text: "Maya read nine pages.",
        attachmentBlocks: ["[Photo attached · workbook · https://example.test/a]"],
        draftFromVoice: true,
      }),
      {
        text: `${VOICE_TRANSCRIPTION_MARKER}: Maya read nine pages.\n\n[Photo attached · workbook · https://example.test/a]`,
        modality: "voice",
      },
    );
  });

  it("does not call an attachment-only turn voice after the dictated draft was erased", () => {
    assert.deepEqual(
      prepareAttachmentChatTurn({
        text: "   ",
        attachmentBlocks: ["[File attached · plan.pdf · https://example.test/a]"],
        draftFromVoice: true,
      }),
      {
        text: "[File attached · plan.pdf · https://example.test/a]",
        modality: "text",
      },
    );
  });
});

describe("isSendLineOccupied", () => {
  // GH #170: a stream that dies mid-turn wipes eve's local session id
  // (busy flips to "error", not "streaming"/"submitted"), while
  // lost-turn recovery is still finding out whether the interrupted
  // turn already finished server-side. A send in that window used to
  // read as free (busy: false) and started a brand new eve session,
  // forking the conversation. Recovering must occupy the line the same
  // way busy does.
  it("treats an in-flight recovery as occupying the line even though nothing is streaming", () => {
    assert.equal(
      isSendLineOccupied({ busy: false, recovering: true }),
      true,
    );
  });

  it("still treats an active stream as occupying the line", () => {
    assert.equal(
      isSendLineOccupied({ busy: true, recovering: false }),
      true,
    );
  });

  it("frees the line once neither a stream nor a recovery is running", () => {
    assert.equal(
      isSendLineOccupied({ busy: false, recovering: false }),
      false,
    );
  });

  it("stays occupied if both happen to be true at once", () => {
    assert.equal(
      isSendLineOccupied({ busy: true, recovering: true }),
      true,
    );
  });
});

describe("prepareChatSend with recovery folded into busy", () => {
  it("queues a send offered while recovering exactly like a busy send, rather than starting a fresh session", () => {
    const plan = prepareChatSend({
      text: "Homa where are my edits",
      busy: isSendLineOccupied({ busy: false, recovering: true }),
      draftFromVoice: false,
      source: { kind: "composer" },
    });
    assert.equal(plan?.destination, "queue");
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

describe("composerPrimaryAction", () => {
  // The ChatGPT composer shape (founder direction 2026-07-29): the empty
  // box offers voice, the first character turns that same button into
  // Send. Getting this wrong either dials a real phone when she meant to
  // send, or hides Send when she has something to say.
  it("offers voice on an empty composer", () => {
    assert.equal(composerPrimaryAction({ draft: "", readyAttachments: 0 }), "voice");
  });

  it("treats whitespace alone as empty", () => {
    assert.equal(composerPrimaryAction({ draft: "   \n ", readyAttachments: 0 }), "voice");
  });

  it("swaps to send on the first real character", () => {
    assert.equal(composerPrimaryAction({ draft: "H", readyAttachments: 0 }), "send");
  });

  // A photo with no caption is still something to send.
  it("counts a staged attachment as something to send", () => {
    assert.equal(composerPrimaryAction({ draft: "", readyAttachments: 1 }), "send");
  });

  it("sends when words and an attachment are both present", () => {
    assert.equal(composerPrimaryAction({ draft: "look", readyAttachments: 2 }), "send");
  });
});
