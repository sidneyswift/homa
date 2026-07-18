import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findInternalNarration } from "./outbound-guard";

/** The exact SMS a real family received on 2026-07-18 instead of a brief. */
const INCIDENT_SMS =
  "This dispatch isn't running in a state where I can prepare and send a morning research brief right now (it needs the authenticated morning dispatch run), so I can't produce or deliver Alma's brief this way. Nothing was sent or saved. If you'd like, I can just answer this as a regular chat message instead, or you can check Homa's tasks page to confirm the morning brief schedule is active.";

/** A real delivered brief from the same family, same morning. */
const REAL_BRIEF =
  "Ara's working on adding and subtracting small numbers in her head, like 7 plus 2, and there's a nice bit of research on how to help with exactly that. A study following kids from 2nd grade into 3rd found the biggest boost came when parents let the child try first and asked guiding questions, rather than jumping in to show the steps. That fits how Ara likes to work things out herself. Want a quick space or unicorn themed number game for this week to practice that together?";

const JOURNAL_PROMPT =
  "How did the morning brief land today? Alma seemed excited about fractions this week. What was the best moment of your day?";

describe("dispatch outbound guard", () => {
  it("blocks the incident message", () => {
    assert.notEqual(findInternalNarration(INCIDENT_SMS), null);
  });

  it("passes real family copy", () => {
    assert.equal(findInternalNarration(REAL_BRIEF), null);
    assert.equal(findInternalNarration(JOURNAL_PROMPT), null);
    assert.equal(
      findInternalNarration(
        "This morning's note for Alma is not ready yet. Want me to pick it up in chat instead?",
      ),
      null,
    );
  });

  it("blocks each internal vocabulary family", () => {
    assert.equal(
      findInternalNarration("The tool prepare_research_brief refused."),
      "internal identifier",
    );
    assert.equal(
      findInternalNarration("This dispatch could not start."),
      "dispatch vocabulary",
    );
    assert.equal(
      findInternalNarration("Your task run failed this morning."),
      "run mechanics",
    );
    assert.equal(
      findInternalNarration("The failure was not retryable."),
      "retry vocabulary",
    );
    assert.equal(
      findInternalNarration("I need an authenticated session for that."),
      "auth vocabulary",
    );
  });

  it("does not trip on links, filenames, domains, or emails with underscores", () => {
    assert.equal(
      findInternalNarration(
        "Here is the worksheet: https://example.com/files/number_line_v2.pdf and a note about it.",
      ),
      null,
    );
    assert.equal(
      findInternalNarration("I saved it as number_line_v2.pdf for you."),
      null,
    );
    assert.equal(
      findInternalNarration(
        "The article on reading_rockets.org covers this nicely.",
      ),
      null,
    );
    assert.equal(
      findInternalNarration("You can write to homa_families@example.com."),
      null,
    );
  });

  it("skips the identifier check for save-only tasks but keeps vocabulary checks", () => {
    const code = "Today's exercise: my_name = 'Ben' then print(my_name).";
    assert.equal(findInternalNarration(code), "internal identifier");
    assert.equal(findInternalNarration(code, { codeAllowed: true }), null);
    assert.equal(
      findInternalNarration("This dispatch could not start.", {
        codeAllowed: true,
      }),
      "dispatch vocabulary",
    );
  });

  it("catches inflected dispatch vocabulary", () => {
    assert.equal(
      findInternalNarration("The system dispatched your note late."),
      "dispatch vocabulary",
    );
  });
});
