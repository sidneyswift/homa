import assert from "node:assert/strict";
import test from "node:test";

import { compose } from "./milestone";

// Regression for the doubled possessive found live in homa_task_runs
// (kind agent_job): start_agent_job's own tool description asks the model
// for a label like "Theo's All About Reading plan", so the body must not
// prepend the child's possessive a second time when the label already
// carries it.
test("compose does not double the child's possessive when the label already has it", () => {
  const label = "Story's alphabet search-and-find set, letters E to Z";

  const gate = compose("gate", label, "Story");
  assert.equal(
    gate.body,
    "Good news: the first part of Story's alphabet search-and-find set, letters E to Z is ready to look over in the Binder. Have a look, and when you are happy, just tell me to keep going and I will build the rest.",
  );
  assert.ok(!gate.body.includes("Story's Story's"));

  const completed = compose("completed", label, "Story");
  assert.equal(
    completed.body,
    "Story's alphabet search-and-find set, letters E to Z is finished. Every part is saved in the Binder, ready whenever you are.",
  );
  assert.ok(!completed.body.includes("Story's Story's"));

  const needsAttention = compose("needs_attention", label, "Story");
  assert.ok(!needsAttention.body.includes("Story's Story's"));
});

test("compose still prepends the child's possessive when the label omits it", () => {
  const { body } = compose("completed", "alphabet search-and-find set", "Story");
  assert.equal(body, "Story's alphabet search-and-find set is finished. Every part is saved in the Binder, ready whenever you are.");
});

test("compose falls back to 'your' when there is no linked child", () => {
  const { body } = compose("completed", "alphabet search-and-find set", null);
  assert.equal(body, "your alphabet search-and-find set is finished. Every part is saved in the Binder, ready whenever you are.");
});

test("compose does not double a label that already starts with 'your'", () => {
  const { body } = compose("completed", "your reading plan", null);
  assert.equal(body, "your reading plan is finished. Every part is saved in the Binder, ready whenever you are.");
});

test("compose does not falsely match a different child's name as a prefix", () => {
  // "Storyline" starts with the letters of "Story" but is not "Story's ...".
  const { body } = compose("completed", "Storyline adventure pack", "Story");
  assert.equal(
    body,
    "Story's Storyline adventure pack is finished. Every part is saved in the Binder, ready whenever you are.",
  );
});

// Titles never doubled (compose never prepends "who" to the title), so this
// just pins that behavior stays intact alongside the body fix.
test("compose titles are unaffected", () => {
  const label = "Story's alphabet search-and-find set, letters E to Z";
  assert.equal(compose("completed", label, "Story").title, `${label} is all done`);
  assert.equal(compose("gate", label, "Story").title, `First part of ${label} is ready`);
  assert.equal(compose("needs_attention", label, "Story").title, `${label} needs a quick look`);
});
