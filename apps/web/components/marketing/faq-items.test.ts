import assert from "node:assert/strict";
import test from "node:test";

import { FAQ_ITEMS } from "./faq-items";

test("the state standards FAQ keeps source context separate from compliance", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "Does Homa follow my state's standards?")?.[1];

  assert.ok(answer);
  assert.match(answer, /^No\./);
  assert.match(answer, /does not determine whether your family meets a state legal requirement/i);
  assert.match(answer, /last-checked date/i);
  assert.match(answer, /national child-development and academic sources/i);
  assert.doesNotMatch(answer, /Homa follows your state's standards/i);
});
