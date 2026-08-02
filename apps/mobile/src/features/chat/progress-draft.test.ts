import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  bindProgressDraftContext,
  mergeProgressDraft,
  progressChildIdForDraft,
  progressChildIdFromRoute,
  progressEvidenceClientContext,
} from "./progress-draft";

const chatSessionSource = readFileSync(
  new URL("./chat-session.tsx", import.meta.url),
  "utf8",
);

describe("Progress to Chat draft handoff", () => {
  it("prefills reviewable text without replacing what she already typed", () => {
    assert.equal(
      mergeProgressDraft("Ask about reading", "Tell Homa about Maya: "),
      "Ask about reading\n\nTell Homa about Maya: ",
    );
    assert.equal(mergeProgressDraft("", "Tell Homa about Maya: "), "Tell Homa about Maya: ");
  });

  it("ignores a duplicate handoff and bounds child route values safely", () => {
    const draft = "Tell Homa about Maya: ";
    assert.equal(mergeProgressDraft(draft, draft), draft);
    assert.equal(progressChildIdFromRoute("child-maya"), "child-maya");
    assert.equal(progressChildIdFromRoute(["child-maya", "ignored"]), "child-maya");
    assert.equal(progressChildIdFromRoute("x".repeat(81)), null);
  });

  it("builds exact one-turn child context without changing her draft", () => {
    assert.deepEqual(progressEvidenceClientContext("child-maya"), {
      source: "progress",
      intent: "share_progress_evidence",
      progressChildId: "child-maya",
    });
  });

  it("retains exact-child context when she appends detail to the Progress prefill", () => {
    const incoming = "Tell Homa about Maya: ";
    const merged = mergeProgressDraft("", incoming);
    const binding = bindProgressDraftContext("child-maya", incoming, merged);

    assert.deepEqual(binding, {
      childId: "child-maya",
      draftPrefix: "Tell Homa about Maya:",
    });
    assert.equal(
      progressChildIdForDraft(binding, `${merged}Maya read a full page.`),
      "child-maya",
    );
  });

  it("drops exact-child context when she replaces the Progress prefill", () => {
    const binding = bindProgressDraftContext(
      "child-maya",
      "Tell Homa about Maya: ",
      "Tell Homa about Maya: ",
    );

    assert.equal(progressChildIdForDraft(binding, "Help with dinner"), null);
  });

  it("does not bind an unrelated draft that existed before the Progress handoff", () => {
    const incoming = "Tell Homa about Maya: ";
    const merged = mergeProgressDraft("Ask about reading", incoming);

    assert.equal(
      bindProgressDraftContext("child-maya", incoming, merged),
      null,
    );
  });
});

describe("Progress draft wiring", () => {
  it("keeps suggestion chips out of the composer provenance lane", () => {
    const suggestionCalls = chatSessionSource.match(
      /sendMessage\(suggestion, "card"\)/gu,
    );
    assert.equal(suggestionCalls?.length, 2);
  });

  it("routes edits through the function that invalidates a replaced prefill", () => {
    assert.match(chatSessionSource, /onChangeText=\{updateDraft\}/u);
    assert.match(
      chatSessionSource,
      /progressChildIdForDraft\(progressDraftBindingRef\.current, next\)/u,
    );
  });
});
