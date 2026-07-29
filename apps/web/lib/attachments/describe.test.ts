import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { describeModelId } from "./describe";

/**
 * Reading an image a parent already sent (gh#351).
 *
 * The failure this closes: captions are one sentence written once, for
 * search, and they were the model's only view of a photo. On 2026-07-25
 * a parent's dictated list of page edits was cut off mid-word, so she
 * sent a screen recording of her own message and then a screenshot of
 * it. Both were captioned "a screen recording of a chat interface",
 * neither was read, and Homa asked her to retype the list.
 */

const describeSource = readFileSync(
  path.join(import.meta.dirname, "describe.ts"),
  "utf8",
);
const toolSource = readFileSync(
  path.join(
    path.resolve(import.meta.dirname, "..", "..", "agent", "tools"),
    "describe_attachment.ts",
  ),
  "utf8",
);

describe("the describe prompt", () => {
  it("transcribes rather than summarizes when asked what something says", () => {
    assert.match(describeSource, /transcribe the\s*\n?\s*text exactly as written/u);
    assert.match(describeSource, /[Nn]ever summarize text you\s*\n?\s*were asked to read/u);
  });

  it("marks a gap instead of repairing unreadable text", () => {
    // The whole point is recovering HER words. A model that tidies a
    // cut-off sentence returns something she never wrote.
    assert.match(describeSource, /\[unreadable\]/u);
    assert.match(describeSource, /never repair it/u);
  });

  it("keeps the fleet pronoun law", () => {
    assert.match(describeSource, /they\/them\/their/u);
  });

  it("uses a configurable model with a cheap default", () => {
    assert.equal(typeof describeModelId(), "string");
    assert.match(describeSource, /HOMA_DESCRIBE_MODEL/u);
  });

  it("reports why it failed rather than returning an empty answer", () => {
    assert.match(describeSource, /reason: "timeout"/u);
    assert.match(describeSource, /reason: "failed"/u);
  });
});

describe("the describe_attachment tool", () => {
  it("re-scopes the url to this family's own storage", () => {
    assert.match(toolSource, /isFamilyArtifactUrl\(input\.url, access\.familyId\)/u);
  });

  it("also requires a real attachment row, not just a matching prefix", () => {
    assert.match(toolSource, /from public\.chat_attachments/u);
    assert.match(toolSource, /family_id = \$\{access\.familyId\}/u);
  });

  it("refuses a non-image instead of sending it to a vision model", () => {
    assert.match(toolSource, /media_type\.startsWith\("image\/"\)/u);
  });

  it("tells Homa to ask rather than guess when the read fails", () => {
    assert.match(toolSource, /rather than pretending to know|rather than guessing/u);
  });

  it("tells Homa not to make her retype what it can now read", () => {
    assert.match(toolSource, /do not ask her to retype/u);
  });

  it("is repeatable, since reading twice changes nothing", () => {
    assert.match(toolSource, /repeatable: true/u);
  });
});
