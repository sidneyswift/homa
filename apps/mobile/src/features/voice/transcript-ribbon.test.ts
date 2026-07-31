import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { whisperText } from "./whisper-text";

/** The ribbon speaks markdown replies as one soft plain line. */
describe("whisperText", () => {
  it("strips bold, italic, and inline code marks", () => {
    assert.equal(
      whisperText("**Monday 7/27** is *light*: just `ten minutes`"),
      "Monday 7/27 is light: just ten minutes",
    );
  });

  it("drops heading and list markers at line starts", () => {
    assert.equal(
      whisperText("## This week\n- counters\n2. sound play"),
      "This week  counters  sound play",
    );
  });

  it("lets newlines breathe as sentence gaps and trims the ends", () => {
    assert.equal(whisperText("Logged.\n\nNice work today.\n"), "Logged.  Nice work today.");
  });

  it("removes fenced code blocks whole", () => {
    assert.equal(whisperText("Before\n```\nx = 1\n```\nafter"), "Before  after");
  });

  it("leaves plain warm copy alone", () => {
    assert.equal(
      whisperText("Great to hear she crushed the addition page."),
      "Great to hear she crushed the addition page.",
    );
  });
});
