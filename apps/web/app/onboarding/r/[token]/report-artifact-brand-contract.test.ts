import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { SubjectScore } from "@homa/core";

import { ReportChart } from "./report-chart";

const ONE_PAGER = readFileSync(new URL("./one-pager/page.tsx", import.meta.url), "utf8");
const EVIDENCE = readFileSync(new URL("./evidence/page.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../../../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

function score(overrides: Partial<SubjectScore>): SubjectScore {
  return {
    subjectId: "math",
    position: "ahead",
    monthsAhead: 8,
    frontierDeltaMonths: 8,
    beyondScale: false,
    highConfidence: true,
    observations: 2,
    strongestObservedStatement: "Makes ten",
    strongestObservedMonths: 60,
    frontierStatement: null,
    frontierItemId: null,
    frontierDomain: null,
    exposureBased: false,
    ...overrides,
  };
}

describe("Quiet print report artifacts", () => {
  it("uses atoms and named artifact hooks without retired utility aliases", () => {
    for (const source of [ONE_PAGER, EVIDENCE]) {
      assert.match(source, /QuietFrame/u);
      assert.match(source, /QuietAction/u);
      assert.match(source, /quiet-print-surface/u);
      assert.match(source, /quiet-print-hidden/u);
      assert.doesNotMatch(source, /font-(?:mono|hand)|rounded-(?:md|lg|xl|2xl|3xl|full)/u);
      assert.doesNotMatch(source, /(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u);
      assert.doesNotMatch(source, /report\.(?:helpWith|whatsWorking|letter)/u);
    }
    assert.ok((ONE_PAGER.match(/data-brand-surface="report-one-pager"/gu) ?? []).length >= 2);
    assert.ok((EVIDENCE.match(/data-brand-surface="report-evidence"/gu) ?? []).length >= 2);
    assert.match(PRIMITIVES, /@page\s*\{\s*size:\s*letter/u);
    assert.match(PRIMITIVES, /\.quiet-print-surface \.quiet-print-hidden/u);
    assert.match(PRIMITIVES, /\.quiet-artifact__chart-frame/u);
  });

  it("keeps the chart semantic output stable while using Quiet typography", () => {
    const markup = renderToStaticMarkup(
      ReportChart({
        scores: [
          score({ subjectId: "math" }),
          score({ subjectId: "reading", position: "growing", monthsAhead: null, frontierDeltaMonths: -3 }),
          score({ subjectId: "science", position: "not_mapped", monthsAhead: null, exposureBased: false }),
        ],
        variant: "wide",
      }),
    );

    assert.match(markup, /quiet-report__chart/u);
    assert.match(markup, /aria-label="Months ahead of age, one dot per subject"/u);
    assert.match(markup, /quiet-report__chart-axis-label/u);
    assert.match(markup, /quiet-report__chart-subject/u);
    assert.match(markup, /quiet-report__chart-value/u);
    assert.equal((markup.match(/quiet-report__chart-subject/g) ?? []).length, 2);
    assert.doesNotMatch(markup, /font-mono|font-hand|rgba\(/u);
  });
});
