import assert from "node:assert/strict";
import test from "node:test";

import {
  checkInstructionsSplit,
  PERSONA_TAIL_HEADING,
  SPLIT_HEADING,
  VOICE_HEADING,
} from "./instructions-split-check.mts";

const GOOD_INSTRUCTIONS = [
  "<!-- header comment -->",
  VOICE_HEADING,
  "- Be clear.",
  PERSONA_TAIL_HEADING,
  "Own it.",
  SPLIT_HEADING,
  "Operations below.",
].join("\n\n");

const GOOD_TELNYX = `const voiceSection = full.split("${SPLIT_HEADING}")[0];`;
const GOOD_MIRROR = `${VOICE_HEADING}\n\n- Be clear.`;

function run(overrides: Partial<Parameters<typeof checkInstructionsSplit>[0]> = {}) {
  return checkInstructionsSplit({
    instructions: GOOD_INSTRUCTIONS,
    telnyxSource: GOOD_TELNYX,
    reportWriter: GOOD_MIRROR,
    curriculumWriter: GOOD_MIRROR,
    ...overrides,
  });
}

test("a healthy tree passes", () => {
  assert.deepEqual(run(), []);
});

test("a duplicate split heading fires", () => {
  const problems = run({
    instructions: `${GOOD_INSTRUCTIONS}\n\n${SPLIT_HEADING}`,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /exactly once, found 2/);
});

test("a missing split heading fires", () => {
  const problems = run({
    instructions: GOOD_INSTRUCTIONS.replace(SPLIT_HEADING, "## Renamed"),
  });
  assert.ok(problems.some((p) => /found 0/.test(p)));
});

test("the persona tail heading must precede the split", () => {
  const reordered = [
    VOICE_HEADING,
    SPLIT_HEADING,
    PERSONA_TAIL_HEADING,
  ].join("\n\n");
  const problems = run({ instructions: reordered });
  assert.ok(problems.some((p) => /must precede the split/.test(p)));
});

test("a second comment block above the split fires", () => {
  const problems = run({
    instructions: `<!-- one -->\n<!-- two -->\n\n${GOOD_INSTRUCTIONS.replace("<!-- header comment -->\n\n", "")}`,
  });
  assert.ok(problems.some((p) => /more than one HTML comment/.test(p)));
});

test("a comment below the split does not fire", () => {
  const problems = run({
    instructions: `${GOOD_INSTRUCTIONS}\n\n<!-- operations note -->`,
  });
  assert.deepEqual(problems, []);
});

test("a heading rename that misses telnyx-provision fires", () => {
  const problems = run({ telnyxSource: "no heading here" });
  assert.ok(problems.some((p) => /telnyx-provision/.test(p)));
});

test("a mirror missing its Voice section fires", () => {
  const problems = run({ curriculumWriter: "# Curriculum writer" });
  assert.ok(
    problems.some((p) => /curriculum-writer\.md is missing/.test(p)),
  );
});
