import assert from "node:assert/strict";
import test from "node:test";

import { FAQ_ITEMS } from "./faq-items";

test("the state-rules FAQ keeps source context separate from compliance", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "Can Homa help with my state's homeschool rules?")?.[1];

  assert.ok(answer);
  assert.match(answer, /^Homa records the teaching hours you report\./);
  assert.match(answer, /does not decide whether your family meets a legal requirement/i);
  assert.match(answer, /date it was last reviewed/i);
  assert.match(answer, /confirm what applies/i);
  assert.match(answer, /state's official website/i);
  assert.doesNotMatch(answer, /Homa follows your state's standards/i);
});

test("the age FAQ states both the report range and the current practice-page limit", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "What ages does Homa cover?")?.[1];

  assert.ok(answer);
  assert.match(answer, /progress reports cover ages 2 to 16/i);
  assert.match(answer, /practice pages currently cover ages 2 to 7/i);
});

test("the privacy FAQ gives a plain use, training, and deletion boundary", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "How does Homa use my family's information?")?.[1];

  assert.ok(answer);
  assert.match(answer, /use what you share only to run Homa for your family/i);
  assert.match(answer, /do not sell it or use it to train AI models/i);
  assert.match(answer, /delete your family's records/i);
  assert.match(answer, /Privacy page/i);
  assert.doesNotMatch(answer, /lists the companies/i);
});

test("the pricing FAQ explains the three prices and what changes", () => {
  const answer = FAQ_ITEMS.find(([question]) => question === "How much does Homa cost?")?.[1];

  assert.ok(answer);
  assert.match(answer, /add a credit card to start 7 free days/i);
  assert.match(answer, /Homa is \$19 a month/i);
  assert.match(answer, /Homa Plus is \$49 a month/i);
  assert.match(answer, /Homa Max is \$199 a month/i);
  assert.match(answer, /practice pages/i);
  assert.match(answer, /Homa Plus includes curriculum-file uploads for weekly planning/i);
  assert.match(answer, /Homa Max is a limited service membership/i);
  assert.match(answer, /membership picker names exactly what Homa is offering/i);
  assert.doesNotMatch(answer, /only when available|when it is available|whether it is available/i);
  assert.doesNotMatch(answer, /text messages|phone calls|printed materials|planning with a person/i);
  assert.match(answer, /annual memberships are paid once for the year/i);
  assert.match(answer, /stop any membership from renewing in your settings/i);
});
