import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MAP_SUBJECTS } from "@homa/core";
import { ProgressComparisonReading } from "./progress-comparison";
import { buildProgressComparison } from "../../lib/child-progress/comparison";
import { comparisonFixture } from "../../lib/child-progress/comparison-fixture";
test("actual reading names its number, old evidence/date/derivation and source explanation",()=>{
 const view=comparisonFixture([{itemId:"gross_motor.catches-ball",observedAt:"2025-09-06T12:00:00Z",derivation:"inferred"},{itemId:"gross_motor.gallops"}]);
 const html=renderToStaticMarkup(<ProgressComparisonReading comparison={buildProgressComparison(view,"gross_motor")} timeZone={view.timeZone}/>);
 for(const text of ["About 10 months ahead","Sep 6, 2025","Homa matched this from what was shared","How this comparison works","CDC","six months less","not a national standardized test"])assert.ok(html.includes(text),text);
 assert.ok(html.indexOf("Sep 6, 2025")<html.indexOf("How this comparison works"));
});
test("nonpositive, unavailable, and only-not-yet do not render an ahead number",()=>{
 for(const view of [comparisonFixture([{itemId:"gross_motor.catches-ball"}],{ageMonths:60}),comparisonFixture([{itemId:"gross_motor.gallops",answer:"not_yet"}])]){
  const html=renderToStaticMarkup(<ProgressComparisonReading comparison={buildProgressComparison(view,"gross_motor")} timeZone={view.timeZone}/>);assert.doesNotMatch(html,/About \d+ months|At least \d+ months/u);
 }
 const view=comparisonFixture();view.scores.subjects.find(s=>s.subjectId==="gross_motor")!.monthsAhead=20;
 assert.match(renderToStaticMarkup(<ProgressComparisonReading comparison={buildProgressComparison(view,"gross_motor")} timeZone={view.timeZone}/>),/could not be checked/u);
});

test("the reading distinguishes a display cap from a checklist ceiling", () => {
 const top=[...MAP_SUBJECTS.find(subject=>subject.id==="gross_motor")!.items].sort((a,b)=>b.typicalMonths-a.typicalMonths)[0]!;
 for (const [view, expected, absent] of [
  [comparisonFixture([{itemId:"gross_motor.catches-ball"}],{ageMonths:36}), "reached Homa&#x27;s display limit", "an Easily answer reached the top"],
  [comparisonFixture([{itemId:top.id}],{ageMonths:top.typicalMonths-8}), "an Easily answer reached the top", "reached Homa&#x27;s display limit"],
 ] as const) {
  const html=renderToStaticMarkup(<ProgressComparisonReading comparison={buildProgressComparison(view,"gross_motor")} timeZone={view.timeZone}/>);
  assert.ok(html.includes(expected)); assert.ok(!html.includes(absent));
 }
});
test("internal taxonomy references keep their names without a broken browser link", () => {
 const view=comparisonFixture([{itemId:"math.comparing-groups-more-or-fewer"}],{ageMonths:24});
 const comparison=buildProgressComparison(view,"math");
 assert.ok(comparison.basis[0]!.citations.length>0);
 assert.ok(comparison.basis[0]!.citations.every(citation=>citation.url===null));
 const html=renderToStaticMarkup(<ProgressComparisonReading comparison={comparison} timeZone={view.timeZone}/>);
 assert.ok(html.includes("Common Core State Standards for Mathematics"));
 assert.ok(html.includes("(catalog reference)")); assert.ok(!html.includes('href="gs:'));
});
