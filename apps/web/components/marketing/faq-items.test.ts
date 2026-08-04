import assert from "node:assert/strict";
import test from "node:test";

import { FAQ_ITEMS } from "./faq-items";

test("the state-rules FAQ keeps source context separate from compliance", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "Can Homa help with my state's homeschool rules?")?.[1];

  assert.ok(answer);
  assert.match(answer, /^Yes, with sources and clear limits\./);
  assert.match(answer, /does not decide whether your family meets a legal requirement/i);
  assert.match(answer, /each source was last checked/i);
  assert.match(answer, /official website to confirm what applies/i);
  assert.doesNotMatch(answer, /Homa follows your state's standards/i);
});

test("the pricing FAQ explains the three prices and what changes", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "How much does Homa cost?")?.[1];

  assert.ok(answer);
  assert.match(answer, /add a credit card to start 7 free days/i);
  assert.match(answer, /Homa is \$19 a month/i);
  assert.match(answer, /Homa Plus is \$49 a month/i);
  assert.match(answer, /Homa Max is \$199 a month/i);
  assert.match(answer, /practice pages/i);
  assert.match(answer, /text messages, phone calls, and uploaded curriculum/i);
  assert.match(answer, /printed materials by mail and planning with a person/i);
  assert.match(answer, /annual memberships are paid once for the year/i);
  assert.match(answer, /stop any membership from renewing in your settings/i);
});
