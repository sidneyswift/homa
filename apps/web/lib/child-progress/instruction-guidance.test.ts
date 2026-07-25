import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { LINKED_SMS_PROGRESS_GUIDANCE } from "./instruction-guidance";

const instructions = readFileSync(
  new URL("../../agent/instructions.md", import.meta.url),
  "utf8",
);

describe("linked SMS progress guidance", () => {
  it("keeps every SMS-only delta", () => {
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /manage_child_progress/u);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /exact server statement/u);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /word for word/u);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /rewording the statement/iu);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /One question\s+per text/u);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /no rich cards/u);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /pauses the check-in/u);
    assert.match(LINKED_SMS_PROGRESS_GUIDANCE, /never call signup tools/iu);
  });

  it("carries no second copy of the channel-agnostic workflow", () => {
    // The trim (2026-07-25) left the workflow's one home in
    // instructions.md and the tool schema. If these phrases creep back
    // in, the SMS turn is paying for the same rule twice.
    assert.doesNotMatch(LINKED_SMS_PROGRESS_GUIDANCE, /record_journal_evidence/u);
    assert.doesNotMatch(LINKED_SMS_PROGRESS_GUIDANCE, /log_hours/u);
    assert.doesNotMatch(LINKED_SMS_PROGRESS_GUIDANCE, /bounded partial/u);
    assert.doesNotMatch(LINKED_SMS_PROGRESS_GUIDANCE, /takeover_check_in/u);
    assert.doesNotMatch(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /no live delivered question matches/u,
    );
  });

  it("finds the moved bounded-partial rule in its canonical home", () => {
    // Moved from this constant into instructions.md's
    // translate-conservatively bullet (channel-agnostic judgment).
    assert.match(instructions, /bounded partial answer/iu);
    assert.match(instructions, /getting_there/u);
  });
});
