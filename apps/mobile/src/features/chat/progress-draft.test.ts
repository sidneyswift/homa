import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  bindProgressDraftContext,
  mergeProgressDraft,
  progressChildIdForDraft,
  progressChildIdFromRoute,
  progressContextForDraft,
  progressDraftIntentFromRoute,
  progressEvidenceClientContext,
  progressFingerprintFromRoute,
  progressTransportForDraft,
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
      intent: "share_progress_evidence",
      proposalFingerprint: null,
    });
    assert.equal(
      progressChildIdForDraft(binding, `${merged}Maya read a full page.`),
      "child-maya",
    );
  });

  it("keeps one exact next-move fingerprint while the parent edits the prefill", () => {
    const fingerprint = "a".repeat(64);
    const incoming = "Could we make this idea work without craft supplies?";
    const binding = bindProgressDraftContext(
      "child-maya",
      incoming,
      incoming,
      "review_progress_next_move",
      fingerprint,
    );

    const transport = progressTransportForDraft(
      binding,
      `${incoming} We have ten minutes.`,
    );
    assert.deepEqual(transport, {
      headers: {
        "x-homa-progress-next-move-child": "child-maya",
        "x-homa-progress-next-move-fingerprint": fingerprint,
      },
    });
    assert.equal("clientContext" in (transport ?? {}), false);
    assert.deepEqual(progressContextForDraft(binding, "Help with dinner"), {
      source: "progress",
      intent: "review_progress_next_move",
      progressChildId: "child-maya",
      progressNextMoveFingerprint: fingerprint,
    });
  });

  it("rejects malformed route intent and fingerprint values", () => {
    assert.equal(
      progressDraftIntentFromRoute("review_progress_next_move"),
      "review_progress_next_move",
    );
    assert.equal(progressDraftIntentFromRoute("make_a_worksheet"), null);
    assert.equal(progressFingerprintFromRoute("b".repeat(64)), "b".repeat(64));
    assert.equal(progressFingerprintFromRoute("not-a-fingerprint"), null);
  });

  it("keeps exact-child context when she rewrites the Progress prefill", () => {
    const binding = bindProgressDraftContext(
      "child-maya",
      "Tell Homa about Maya: ",
      "Tell Homa about Maya: ",
    );

    assert.equal(
      progressChildIdForDraft(binding, "Help with dinner"),
      "child-maya",
    );
    assert.equal(progressChildIdForDraft(binding, "   "), null);
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
  it("keeps any suggestion chips out of the composer provenance lane", () => {
    // App 2 (gh#1236) opens on Homa alone, without chips. If chips
    // return, each one must still send as a card, never as typed text.
    const suggestionSends = chatSessionSource.match(/sendMessage\(suggestion\b[^)]*\)/gu) ?? [];
    assert.ok(suggestionSends.every(call => call === 'sendMessage(suggestion, "card")'));
  });

  it("keeps attached context through edits until send or explicit unlink", () => {
    assert.match(chatSessionSource, /onChangeText=\{updateDraft\}/u);
    assert.doesNotMatch(chatSessionSource, /progressContextForDraft/u);
    assert.match(chatSessionSource, /progressTransportForDraft/u);
    assert.match(chatSessionSource, /Progress move attached/u);
    assert.match(chatSessionSource, /Remove context/u);
    assert.match(chatSessionSource, /setProgressDraftBinding\(null\)/u);
  });

  it("provides a bounded multiline composer for meaningful edits", () => {
    assert.match(chatSessionSource, /multiline/u);
    assert.match(chatSessionSource, /submitBehavior="submit"/u);
    assert.match(chatSessionSource, /maxHeight: 128/u);
    assert.match(chatSessionSource, /textAlignVertical: "top"/u);
  });

  it("asks before replacing an occupied composer and preserves the earlier draft", () => {
    assert.match(chatSessionSource, /setPendingProgressDraft\(incoming\)/u);
    assert.match(chatSessionSource, /You already have a draft/u);
    assert.match(chatSessionSource, /setParkedComposer/u);
    assert.match(chatSessionSource, /Your earlier draft is safe/u);
    assert.match(chatSessionSource, /Back to my draft/u);
    assert.doesNotMatch(chatSessionSource, /sendMessage\(draftRequest\.text/u);
  });
});
