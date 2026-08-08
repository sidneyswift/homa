import assert from "node:assert/strict";
import test from "node:test";

import { FAQ_ITEMS } from "./faq-items";

test("the state-rules FAQ keeps source context separate from compliance", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "Can Homa help with my state's homeschool rules?")?.[1];

  assert.ok(answer);
  assert.match(answer, /^Homa records the hours you report/);
  assert.match(answer, /does not decide whether your family meets a legal requirement/i);
  assert.match(answer, /dated state-rule sources/i);
  assert.match(answer, /confirm it/i);
  assert.match(answer, /state's official website/i);
  assert.doesNotMatch(answer, /Homa follows your state's standards/i);
});

test("the age FAQ states both the report range and the current practice-page limit", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "What ages does Homa cover?")?.[1];

  assert.ok(answer);
  assert.match(answer, /progress reports cover ages 2 to 16/i);
  assert.match(answer, /practice pages currently cover ages 2 to 7/i);
});

test("the curriculum FAQ explains the available chat setup without selling Plus", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "Can I use my own curriculum?")?.[1];

  assert.ok(answer);
  assert.match(answer, /Tell Homa in chat/u);
  assert.match(answer, /which curriculum and lessons you use/u);
  assert.doesNotMatch(answer, /Homa Plus|upload/iu);
});

test("the privacy FAQ gives a plain use, sale, and deletion boundary", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "How does Homa use my family's information?")?.[1];

  assert.ok(answer);
  assert.match(answer, /use what you share to run Homa for your family/i);
  assert.match(answer, /do not sell it/i);
  assert.match(answer, /delete your family's records/i);
  assert.match(answer, /Privacy page/i);
  assert.doesNotMatch(answer, /train AI models|no-training|zero-retention/i);
  assert.doesNotMatch(answer, /lists the companies/i);
});

test("the FAQ does not repeat the complete pricing section", () => {
  assert.equal(
    FAQ_ITEMS.some(([question]) => question === "How much does Homa cost?"),
    false,
  );
});

test("every collapsed answer stays short enough to scan", () => {
  const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length;

  for (const [question, answer] of FAQ_ITEMS) {
    assert.ok(wordCount(answer) <= 45, `${question} is too dense`);
  }
});
