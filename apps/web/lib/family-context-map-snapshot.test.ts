import { MAP_SUBJECTS } from "@homa/core";
import { readCanonicalChildMap } from "./map/canonical-explore";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderFamilyContext, type FamilyContextRows } from "./family-context";
import { renderChildProgressAgentContext, loadChildProgressAgentContext } from "./child-progress/agent-context";
import { comparisonFixture, COMPARISON_CHILD, COMPARISON_FAMILY } from "./child-progress/comparison-fixture";
import { buildProgressComparison } from "./child-progress/comparison";
const parse = (text: string) => JSON.parse(text.slice(text.indexOf("{",text.indexOf("\n\n"))));
test("compatibility answers can no longer override canonical comparison authority", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-12T12:00:00Z") });
  const view = comparisonFixture();
  const rows: FamilyContextRows = {
    family: { name: "Synthetic", us_state: null, parent_display_name: null },
    children: [{ id: COMPARISON_CHILD, name: "Maya", birth_month: view.birthDate, profile: null }],
    memories: [],
    members: [],
  };
  const legacyRows = {
    ...rows,
    get answers() {
      return assert.fail("Family context must not read legacy compatibility answers");
    },
  };
  const family = renderFamilyContext(rows);
  assert.equal(renderFamilyContext(legacyRows), family);
  assert.doesNotMatch(family, /chart reads|16 months ahead|\+20/u);
  assert.match(parse(family).mapSnapshot, /canonical Progress/u);
  const context = parse(renderChildProgressAgentContext({ checkIns: [], views: [view] }));
  assert.deepEqual(context.liveProgress[0].comparisons.find((c: { subjectId: string }) => c.subjectId === "gross_motor"), buildProgressComparison(view, "gross_motor"));
  assert.equal(context.liveProgress[0].comparisons.find((c: { subjectId: string }) => c.subjectId === "gross_motor").monthsAhead, 10);
});
test("unread and failed child views are explicit, not no evidence",async()=>{
 const ids=Array.from({length:10},(_,i)=>`child-${i}`);
 const rendered=await loadChildProgressAgentContext({familyId:COMPARISON_FAMILY,childIds:ids},{listFamilyCheckIns:async()=>[],getChildProgressView:async(f,id)=>{assert.equal(f,COMPARISON_FAMILY);if(id==="child-0")throw new Error("offline");if(id==="child-1")return null;return {...comparisonFixture([]),childId:id};}});
 const data=parse(rendered);assert.equal(data.omitted.childViews,4);assert.deepEqual(data.unavailableChildIds,["child-0","child-1"]);assert.match(rendered,/not evidence of absence/u);
});
test("subjects beyond the first six detail groups retain their canonical comparison",async()=>{
 const entries=MAP_SUBJECTS.slice(0,8).map(subject=>({itemId:subject.items[0]!.id}));
 const view=comparisonFixture(entries);assert.equal(view.subjects.length,8);
 const selected=view.subjects[7]!.subjectId;
 const data=parse(renderChildProgressAgentContext({checkIns:[],views:[view]}));
 const loaded=data.liveProgress.find((entry:{childId:string})=>entry.childId===view.childId);
 assert.ok(loaded,"focused child reading must fit");assert.equal(loaded.omittedSubjectDetails,2);
 assert.deepEqual(loaded.comparisons.find((entry:{subjectId:string})=>entry.subjectId===selected),buildProgressComparison(view,selected));
 const exact=await readCanonicalChildMap({familyId:COMPARISON_FAMILY,childId:COMPARISON_CHILD,query:{query:"subject_map",subjectId:selected}},{getView:async()=>view});
 assert.ok("comparison"in exact);assert.deepEqual(exact.comparison,buildProgressComparison(view,selected));
});
