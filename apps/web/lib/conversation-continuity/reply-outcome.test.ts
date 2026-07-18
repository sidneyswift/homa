import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REPLY_CLASSIFIER_VERSION,
  classifyReplyOutcome,
} from "./reply-outcome";

describe("reply outcome classifier", () => {
  it("classifies high-confidence natural affirmative replies", () => {
    for (const text of [
      "Yes, make it",
      "Yeah please make one",
      "Go ahead",
      "Please do",
      "I'd love that",
      "That would be great",
      "No problem",
      "Why not",
      "👍",
      "👍🏽",
    ]) {
      assert.equal(classifyReplyOutcome("yes_no", text), "accepted", text);
    }
  });

  it("classifies high-confidence natural declines", () => {
    for (const text of [
      "Not today",
      "Maybe later",
      "We're good",
      "No need",
      "Skip it",
      "Pass",
      "👎",
      "👎🏻",
    ]) {
      assert.equal(classifyReplyOutcome("yes_no", text), "declined", text);
    }
  });

  it("keeps questions, mixed polarity, uncertainty, and long prose as answers", () => {
    for (const text of [
      "Yes, but not today",
      "Yes, can you make it for Maya?",
      "Yes I have a question",
      "Sure?",
      "Why not?",
      "No, actually yes, please make it",
      "Not sure",
      "Maybe",
      "Yes and no",
      `Yes ${"because we have a few things to sort out first ".repeat(5)}`,
    ]) {
      assert.equal(classifyReplyOutcome("yes_no", text), "answered", text);
    }
  });

  it("classifies approval like yes or no and other contracts as answered", () => {
    assert.equal(classifyReplyOutcome("approval", "Absolutely"), "accepted");
    assert.equal(classifyReplyOutcome("free_text", "Yes"), "answered");
    assert.equal(classifyReplyOutcome("choice", "No"), "answered");
  });

  it("exports a stable classifier version for durable audit rows", () => {
    assert.equal(REPLY_CLASSIFIER_VERSION, "reply-intent-v3");
  });
});
