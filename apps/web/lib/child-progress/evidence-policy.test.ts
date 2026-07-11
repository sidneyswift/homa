import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MapAnswer } from "@homa/core";

import {
  classifyJournalEvidence,
  isProgressEvidenceAnswer,
} from "./evidence-policy";
import type { ProgressEvidenceAnswer } from "./types";

const CHILD_NAME = "Maya";

function classifyJournalQuote(
  quote: string,
  childName = CHILD_NAME,
): ReturnType<typeof classifyJournalEvidence> {
  return classifyJournalEvidence({ quote, childName });
}

function narrowProgressEvidenceAnswer(
  answer: MapAnswer,
): ProgressEvidenceAnswer | null {
  return isProgressEvidenceAnswer(answer) ? answer : null;
}

describe("progress evidence answer policy", () => {
  it("accepts only answers that describe skill progress", () => {
    assert.equal(isProgressEvidenceAnswer("easily"), true);
    assert.equal(isProgressEvidenceAnswer("getting_there"), true);
    assert.equal(isProgressEvidenceAnswer("not_yet"), true);
    assert.equal(isProgressEvidenceAnswer("not_sure"), false);
    assert.equal(isProgressEvidenceAnswer("skip"), false);
  });

  it("narrows accepted answers to the evidence-answer type", () => {
    assert.equal(narrowProgressEvidenceAnswer("easily"), "easily");
    assert.equal(narrowProgressEvidenceAnswer("skip"), null);
  });
});

describe("journal evidence classification", () => {
  it("keeps activity-only journal text out of progress evidence", () => {
    assert.equal(
      classifyJournalQuote("We read for 30 minutes"),
      "activity_only",
    );
    assert.equal(
      classifyJournalQuote("We did math today"),
      "activity_only",
    );
    assert.equal(
      classifyJournalQuote("We read a book together"),
      "activity_only",
    );
    assert.equal(
      classifyJournalQuote("She watched a science video"),
      "activity_only",
    );
  });

  it("recognizes a concrete observed skill", () => {
    assert.equal(
      classifyJournalQuote(
        "Maya read a short chapter book aloud and retold the plot",
      ),
      "concrete_skill",
    );
  });

  it("keeps concrete skill evidence in mixed activity text", () => {
    assert.equal(
      classifyJournalQuote(
        "We read for 30 minutes, and Maya retold the whole plot without help",
      ),
      "concrete_skill",
    );
  });

  it("does not treat a later singular pronoun as child evidence", () => {
    assert.equal(
      classifyJournalQuote(
        "Maya studied with her friend. She read aloud and retold the plot",
      ),
      "unclear",
    );
  });

  it("does not treat a later plural pronoun as child evidence", () => {
    assert.equal(
      classifyJournalQuote(
        "Maya sat with a tutor. They read aloud and retold the plot",
      ),
      "unclear",
    );
  });

  it("stays conservative when the journal text is ambiguous", () => {
    assert.equal(
      classifyJournalQuote("Maya had a good learning day"),
      "unclear",
    );
    assert.equal(
      classifyJournalQuote("Maya cannot wait to read the next chapter"),
      "unclear",
    );
    assert.equal(
      classifyJournalQuote(
        "I can read the directions, but Maya has not tried yet",
      ),
      "unclear",
    );
  });

  it("does not attribute an adult's performance to the child", () => {
    assert.equal(
      classifyJournalQuote(
        "Dad read the directions and explained them to Maya",
      ),
      "unclear",
    );
    assert.equal(
      classifyJournalQuote(
        "Maya talked to Dad. He read the directions and explained them",
      ),
      "unclear",
    );
    assert.equal(
      classifyJournalQuote(
        "Maya talked to Jordan. He read the directions and explained them",
      ),
      "unclear",
    );
  });
});
