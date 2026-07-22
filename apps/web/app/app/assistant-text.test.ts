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

  it("catches the gerund forms", () => {
    // "(waiting for her response)" reached a parent on the opening turn.
    // The list read `waits?`, which matches "wait" and "waits" and not
    // the form a model reaches for when describing something ongoing.
    for (const text of [
      "(waiting for her response)",
      "*(waiting for her response)*",
      "_awaiting her reply_",
      "(listening)",
      "(pausing while she reads)",
      "(holding while the card is up)",
      "(standing by)",
    ]) {
      assert.equal(isStageDirection(text), true, text);
    }
  });

  it("catches turn-taking narration that does not open on the verb", () => {
    // Homa speaks to the parent as "you". A wrapped aside calling her
    // "her" or "she" is describing the conversation from outside it.
    for (const text of [
      "(her response will come through the card)",
      "(she has not replied yet)",
      "(the parent will answer next)",
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
      // "her" inside an aside can mean a daughter, so the turn-taking
      // rule has to be about turn-taking and nothing else.
      "(her reading is coming along)",
      "(she loves dinosaurs right now)",
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

  it("catches narration that does not open on I", () => {
    // "Noted, waiting for her to fill that in." reached a parent under
    // Homa's hello. Unwrapped, so the stage-direction rule did not
    // apply, and it opens on "Noted", so the I-anchored rule did not
    // either. The tell is who it is about, not where it starts.
    for (const text of [
      "Noted, waiting for her to fill that in.",
      "Waiting for her to answer.",
      "Standing by while she fills that in.",
      "Her reply is what I am waiting for.",
    ]) {
      assert.equal(isNarratedPause(text), true, text);
    }
  });

  it("catches the standing offer", () => {
    // "I'm here whenever you're ready." Addressed to her, warm, and
    // still a whole message about Homa doing nothing. The card under it
    // is already the invitation.
    for (const text of [
      "I'm here whenever you're ready.",
      "I am here when you are.",
      "I'll be here whenever you want to pick this up.",
      "I'm right here.",
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
      // A child can be "she" and can be waiting for something. The rule
      // must not reach for a sentence that is about a kid.
      "Mia has been waiting all week for the dinosaur one.",
      "Leo is listening to that audiobook again.",
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
