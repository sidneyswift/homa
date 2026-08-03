import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LessonsCard } from "./lessons-card";

describe("LessonsCard Quiet authority projection", () => {
  it("keeps the recording door and lesson links on shared primitives", () => {
    const html = renderToStaticMarkup(
      <LessonsCard
        card={{
          recordHref: "/app/child-maya/lessons/record",
          lessons: [
            { id: "lesson-1", status: "ready", startedAt: "2026-08-03T12:00:00.000Z" },
          ],
        }}
      />,
    );

    assert.match(html, /data-brand-surface="lessons-card"/u);
    assert.match(html, /data-brand-fixture="quiet-authority-v1"/u);
    assert.match(html, /quiet-frame quiet-frame--paper/u);
    assert.match(html, /quiet-action quiet-action--primary/u);
    assert.doesNotMatch(html, /clay|bg-brand|text-brand|Schibsted|Hanken|Caveat/u);
  });
});
