import assert from "node:assert/strict";
import test from "node:test";

import { compose, materialMediaUrls } from "./milestone";

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

// A one-stage making (the onboarding first making) is one thing, so its
// milestones never say "every part" or offer to build "the rest".
test("compose words a single-stage job as one thing", () => {
  const completed = compose("completed", "Mia's dinosaur coloring page", "Mia", 1);
  assert.equal(
    completed.body,
    "Mia's dinosaur coloring page is ready. It is saved in the Binder and waiting in your Homa chat too.",
  );
  const needsAttention = compose("needs_attention", "Mia's dinosaur coloring page", "Mia", 1);
  assert.equal(
    needsAttention.body,
    "The build for Mia's dinosaur coloring page hit a snag and paused. Nothing is lost. Want me to try it again?",
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

// The delivery half of the voice-materials bridge (#187): a background build
// used to text the parent that her worksheet was ready and attach nothing,
// because deliverJobMilestone sent words only while create_printable had
// been attaching preview + PDF since the MMS path shipped.
test("materialMediaUrls puts the preview before the print file", () => {
  const urls = materialMediaUrls([
    { preview_url: "https://blob/a.jpg", pdf_url: "https://blob/a.pdf" },
  ]);
  assert.deepEqual(urls, ["https://blob/a.jpg", "https://blob/a.pdf"]);
});

test("materialMediaUrls keeps newest-first order across materials", () => {
  const urls = materialMediaUrls([
    { preview_url: "https://blob/new.jpg", pdf_url: "https://blob/new.pdf" },
    { preview_url: "https://blob/old.jpg", pdf_url: "https://blob/old.pdf" },
  ]);
  assert.deepEqual(urls, [
    "https://blob/new.jpg",
    "https://blob/new.pdf",
    "https://blob/old.jpg",
    "https://blob/old.pdf",
  ]);
});

// A blank URL in the MMS payload gets the whole message rejected, which
// would take the words down with the picture. Drop it instead.
test("materialMediaUrls drops missing and blank urls rather than sending them", () => {
  const urls = materialMediaUrls([
    { preview_url: "https://blob/a.jpg", pdf_url: null },
    { preview_url: "   ", pdf_url: "https://blob/b.pdf" },
    { preview_url: null, pdf_url: null },
  ]);
  assert.deepEqual(urls, ["https://blob/a.jpg", "https://blob/b.pdf"]);
});

test("materialMediaUrls on a job with no finished materials sends words only", () => {
  assert.deepEqual(materialMediaUrls([]), []);
});
