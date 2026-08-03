import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageSource = readFileSync(new URL("./lessons/%5BlessonId%5D/page.tsx", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("./lessons/%5BlessonId%5D/review-client.tsx", import.meta.url), "utf8");

describe("Lesson review Quiet authority projection", () => {
  it("marks both pipeline states and the ready review with the shared surface", () => {
    assert.match(pageSource, /data-brand-surface="lesson-review"/u);
    assert.match(pageSource, /data-brand-fixture="quiet-authority-v1"/u);
    assert.match(pageSource, /quiet-frame quiet-frame--paper/u);
    assert.match(pageSource, /quiet-status quiet-status--constructive/u);
    assert.match(clientSource, /kind="primary"/u);
    assert.match(clientSource, /quiet-frame quiet-frame--paper/u);
    assert.doesNotMatch(pageSource, /clay|bg-brand|text-brand|Schibsted|Hanken|Caveat/u);
    assert.doesNotMatch(clientSource, /clay|bg-brand|text-brand|Schibsted|Hanken|Caveat/u);
  });
});
