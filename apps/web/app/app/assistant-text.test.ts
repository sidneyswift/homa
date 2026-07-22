import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isNarratedPause,
  isStageDirection,
  visibleAssistantTexts,
} from "./assistant-text";

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

describe("isNarratedPause", () => {
  it("catches the two seen live on the opening turn", () => {
    // Third person about the parent, addressed to nobody.
    assert.equal(isNarratedPause("I'll continue once she replies."), true);
    // Addressed to her, but still only a description of doing nothing.
    assert.equal(isNarratedPause("I'll wait here while you fill that in."), true);
  });

  it("catches the near neighbours", () => {
    for (const text of [
      "I will wait for her answer.",
      "I'm going to hold off until she picks one.",
      "I'll stand by.",
      "I'll stay quiet while she fills it in.",
      "I\u2019ll continue once she replies.",
    ]) {
      assert.equal(isNarratedPause(text), true, text);
    }
  });

  it("leaves real replies alone, including ones that open with I'll", () => {
    for (const text of [
      "I'll make Mia a worksheet for that tomorrow.",
      "I'll remember that about Leo.",
      "I'll put it on the planner for Thursday.",
      "Tell me about your kids and I will keep track of where they are.",
      "Hey, I'm Homa. Your homeschool helper.",
      "There is no rush, and you can come back to this whenever you like.",
    ]) {
      assert.equal(isNarratedPause(text), false, text);
    }
  });

  it("leaves a reply that says something real alongside the pause", () => {
    assert.equal(
      isNarratedPause(
        "I'll wait for that. Meanwhile, Mia's reading is what I would push on next.",
      ),
      false,
    );
  });
});

describe("visibleAssistantTexts", () => {
  it("drops the bare narrated pause and keeps the opener", () => {
    assert.deepEqual(
      visibleAssistantTexts([
        "Hey, I'm Homa. Your homeschool helper.",
        "I'll continue once she replies.",
      ]),
      ["Hey, I'm Homa. Your homeschool helper."],
    );
  });

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

describe("the render path uses the same predicates", () => {
  it("message-parts filters narrated pauses, not just visibleAssistantTexts", () => {
    // A source check, deliberately. assistantItems needs each part's
    // index, so it inlines the same two predicates instead of calling
    // visibleAssistantTexts, and the first version of this filter was
    // added to the helper alone. It passed every unit test and changed
    // nothing on screen: "I'll continue once she replies." rendered to a
    // real parent anyway. This asserts the render path calls it too.
    const source = readFileSync(
      new URL("./message-parts.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /isNarratedPause\(trimmed\)/);
  });
});
