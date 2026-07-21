import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enforceCopyLaws } from "./copy-laws-runtime";

describe("enforceCopyLaws", () => {
  it("leaves ordinary text untouched, including the object identity", () => {
    const text = "Mia counts to twenty now, which is new since June.";
    assert.equal(enforceCopyLaws(text), text);
  });

  it("replaces the em dash the model actually produced", () => {
    // The real first-turn output from the 2026-07-21 walk.
    assert.equal(
      enforceCopyLaws(
        "tell me a bit about your child (or kids) — their name and age is plenty for now.",
      ),
      "tell me a bit about your child (or kids), their name and age is plenty for now.",
    );
  });

  it("does not stack a comma onto punctuation already doing the job", () => {
    assert.equal(
      enforceCopyLaws("Take your time, — there is no rush."),
      "Take your time, there is no rush.",
    );
  });

  it("keeps a numeric range a range", () => {
    assert.equal(enforceCopyLaws("ages 4–6 work well"), "ages 4-6 work well");
    assert.equal(enforceCopyLaws("about 10–15 minutes"), "about 10-15 minutes");
  });

  it("handles a dash at either end without leaving a stray comma", () => {
    assert.equal(enforceCopyLaws("— that is fine"), "that is fine");
    assert.equal(enforceCopyLaws("that is fine —"), "that is fine");
  });

  it("handles several in one message", () => {
    assert.equal(
      enforceCopyLaws("one — two — three"),
      "one, two, three",
    );
  });

  it("is idempotent, so re-rendering never compounds", () => {
    const once = enforceCopyLaws("reading — her favorite");
    assert.equal(enforceCopyLaws(once), once);
  });
});
