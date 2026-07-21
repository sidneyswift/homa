import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isStageDirection, visibleAssistantTexts } from "./assistant-text";

describe("isStageDirection", () => {
  it("catches the one Homa actually wrote", () => {
    assert.equal(
      isStageDirection("*(waits silently while the card is on her screen)*"),
      true,
    );
  });

  it("catches the near neighbours", () => {
    for (const text of [
      "*waits*",
      "_says nothing_",
      "(stays quiet while she fills it in)",
      "*pauses for her answer*",
      "*no reply needed*",
    ]) {
      assert.equal(isStageDirection(text), true, text);
    }
  });

  it("leaves a real aside to the parent alone", () => {
    // Wrapped, but addressed to HER, which is allowed.
    for (const text of [
      "(it saves as you go)",
      "(you can change this later)",
      "*Mia* is doing well",
      "That's saved.",
      "(PA it is)",
    ]) {
      assert.equal(isStageDirection(text), false, text);
    }
  });

  it("is false for empty and whitespace", () => {
    assert.equal(isStageDirection(""), false);
    assert.equal(isStageDirection("   "), false);
  });
});

describe("visibleAssistantTexts", () => {
  it("drops the verbatim repeat around a card", () => {
    const line =
      "Tell me about your kids and I'll keep track of where they are and make what they need.";
    assert.deepEqual(visibleAssistantTexts([line, line]), [line]);
  });

  it("ignores whitespace differences when deciding it is a repeat", () => {
    assert.deepEqual(
      visibleAssistantTexts(["Hello  there", "Hello there"]),
      ["Hello  there"],
    );
  });

  it("keeps two genuinely different paragraphs", () => {
    assert.deepEqual(
      visibleAssistantTexts(["Mia is doing well.", "Want a worksheet?"]),
      ["Mia is doing well.", "Want a worksheet?"],
    );
  });

  it("drops stage directions and empties, keeping order", () => {
    assert.deepEqual(
      visibleAssistantTexts([
        "Here you go.",
        "   ",
        "*(waits silently)*",
        "Anything else?",
      ]),
      ["Here you go.", "Anything else?"],
    );
  });

  it("returns nothing when the whole reply was a stage direction", () => {
    assert.deepEqual(visibleAssistantTexts(["*(waits silently)*"]), []);
  });
});
