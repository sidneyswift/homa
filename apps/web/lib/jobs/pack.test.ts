import assert from "node:assert/strict";
import test from "node:test";

import { packPageBodies } from "./pack";
import { PAGE_HTML_DELIMITER } from "../materials/page-shell";

// The parent asked for the whole set, so the pack carries the whole set.
// The first version of milestone delivery capped the attachment at the two
// newest materials, which quietly dropped twenty of the twenty-two
// worksheets a real production build had made.
test("packPageBodies keeps every page of every material", () => {
  const bodies = packPageBodies([
    { id: "1", title: "A", html: "<p>a1</p>" },
    { id: "2", title: "B", html: `<p>b1</p>${PAGE_HTML_DELIMITER}<p>b2</p>` },
    { id: "3", title: "C", html: "<p>c1</p>" },
  ]);
  assert.deepEqual(bodies, ["<p>a1</p>", "<p>b1</p>", "<p>b2</p>", "<p>c1</p>"]);
});

// Build order is print order. The set is "letters E to Z", not "Z to E".
test("packPageBodies preserves the order it was given", () => {
  const bodies = packPageBodies([
    { id: "1", title: "E", html: "<p>E</p>" },
    { id: "2", title: "F", html: "<p>F</p>" },
    { id: "3", title: "G", html: "<p>G</p>" },
  ]);
  assert.deepEqual(bodies, ["<p>E</p>", "<p>F</p>", "<p>G</p>"]);
});

test("packPageBodies drops empty page bodies rather than rendering blank sheets", () => {
  const bodies = packPageBodies([
    { id: "1", title: "A", html: `<p>a1</p>${PAGE_HTML_DELIMITER}   ${PAGE_HTML_DELIMITER}<p>a2</p>` },
  ]);
  assert.deepEqual(bodies, ["<p>a1</p>", "<p>a2</p>"]);
});

test("packPageBodies on no materials is empty, so nothing is rendered", () => {
  assert.deepEqual(packPageBodies([]), []);
});

// The real 22-part set in production totals 41,527 characters of HTML,
// against a 120,000 ceiling for a SINGLE material. Combining is cheap; the
// cap was solving the wrong problem.
test("a 22-material set joins into one document well under one material's ceiling", () => {
  const materials = Array.from({ length: 22 }, (_, i) => ({
    id: String(i),
    title: `page ${i}`,
    html: "<p>x</p>".repeat(200),
  }));
  const bodies = packPageBodies(materials);
  assert.equal(bodies.length, 22);
  assert.ok(bodies.join("").length < 120_000, "joined pack fits a single material's html budget");
});
