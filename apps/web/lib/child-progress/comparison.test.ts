import assert from "node:assert/strict";
import { test } from "node:test";
import { MAP_SUBJECTS, scoreMap, subjectLine } from "@homa/core";
import { buildProgressComparison, progressComparisonAge } from "./comparison";
import { comparisonFixture } from "./comparison-fixture";
import { buildProgressTiles } from "./map-model";

const ball = "gross_motor.catches-ball";
const comparison = (ageMonths = 48, itemId = ball) => buildProgressComparison(comparisonFixture([{ itemId }], { ageMonths }), "gross_motor");
test("canonical positive, cap, zero, small positive, and negative frontier keep exact display semantics", () => {
  assert.equal(comparison().displayLabel, "About 10 months ahead");
  const capped = comparison(48, "gross_motor.skips");
  assert.equal(capped.limitReason, "display_cap"); assert.equal(capped.monthsAhead, 16); assert.equal(capped.frontierDeltaMonths, 20); assert.equal(capped.displayLabel, "At least 16 months ahead");
  assert.equal(comparison(56).displayLabel, "About 2 months ahead");
  assert.equal(comparison(58).displayLabel, null);
  assert.equal(comparison(60).frontierDeltaMonths, -2); assert.equal(comparison(60).displayLabel, null);
  const growing = buildProgressComparison(comparisonFixture([{ itemId: ball }, { itemId: "gross_motor.skips", answer: "not_yet" }], { ageMonths: 72 }), "gross_motor");
  assert.equal(growing.monthsAhead, null); assert.equal(growing.frontierDeltaMonths, -14); assert.equal(growing.displayLabel, null);
});
test("bank ceiling remains an at-least reading even below the display cap", () => {
  const subject = MAP_SUBJECTS.find(s => s.id === "gross_motor")!;
  const top = [...subject.items].sort((a,b)=>b.typicalMonths-a.typicalMonths)[0]!;
  const result = comparison(top.typicalMonths - 8, top.id);
  assert.equal(result.limitReason, "checklist_ceiling"); assert.equal(result.beyondScale, true); assert.equal(result.displayLabel, "At least 8 months ahead");
});
test("unknown, exposure and only-not-yet do not invent a numeric comparison", () => {
  assert.equal(buildProgressComparison(comparisonFixture([]), "gross_motor").status, "unknown");
  const subject = MAP_SUBJECTS.find(s=>s.exposureBased)!;
  assert.equal(buildProgressComparison(comparisonFixture([{ itemId: subject.items[0]!.id }]), subject.id).status, "exposure");
  const result = buildProgressComparison(comparisonFixture([{ itemId: "gross_motor.gallops", answer: "not_yet" }]), "gross_motor");
  assert.equal(result.status, "no_frontier"); assert.equal(result.displayLabel, null);
});
test("older winning evidence does not borrow a newer weaker answer date or provenance", () => {
  for (const derivation of ["direct", "inferred", "unknown"] as const) {
    const view = comparisonFixture([{ itemId: ball, observedAt: "2025-09-06T12:00:00Z", derivation }, { itemId: "gross_motor.gallops" }]);
    const result = buildProgressComparison(view, "gross_motor");
    assert.equal(result.basis[0]!.itemId, ball); assert.equal(result.basis[0]!.observedAt, "2025-09-06T12:00:00Z");
    assert.equal(result.basis[0]!.derivation, derivation); assert.ok(result.basis[0]!.citations.some(s=>s.label.includes("CDC")));
    assert.deepEqual(buildProgressTiles(view,new Date(view.projectedAt)).find(t=>t.subjectId==="gross_motor")!.comparison, result);
  }
});
test("credited winner differs from highest raw anchor and getting-there remains emerging", () => {
  let witness: { subjectId: string; easy: string; emerging: string } | undefined;
  for (const subject of MAP_SUBJECTS.filter(s=>!s.exposureBased)) for (const easy of subject.items) for (const emerging of subject.items) {
    if (emerging.typicalMonths <= easy.typicalMonths) continue;
    const a=scoreMap(48,[{itemId:easy.id,answer:"easily"}]).subjects.find(s=>s.subjectId===subject.id)!.frontierDeltaMonths;
    const b=scoreMap(48,[{itemId:emerging.id,answer:"getting_there"}]).subjects.find(s=>s.subjectId===subject.id)!.frontierDeltaMonths;
    if(a!==null&&b!==null&&a>b&&!witness)witness={subjectId:subject.id,easy:easy.id,emerging:emerging.id};
  }
  assert.ok(witness);
  const view=comparisonFixture([{itemId:witness.easy},{itemId:witness.emerging,answer:"getting_there"}]);
  const result=buildProgressComparison(view,witness.subjectId);
  assert.equal(result.basisCount,1);assert.equal(result.basis[0]!.itemId,witness.easy);
  const emerging=buildProgressComparison(comparisonFixture([{itemId:ball,answer:"getting_there"}]),"gross_motor");
  assert.equal(emerging.basis[0]!.answer,"getting_there"); assert.equal(emerging.basis[0]!.creditedAgeMonths,52);
});
test("tied credited frontier retains both evidence dates", () => {
  let pair: { subjectId:string; a:string; b:string } | undefined;
  for(const s of MAP_SUBJECTS.filter(s=>!s.exposureBased))for(const a of s.items)for(const b of s.items){
    if(a.id===b.id)continue;
    if(scoreMap(48,[{itemId:a.id,answer:"easily"}]).subjects.find(v=>v.subjectId===s.id)!.frontierDeltaMonths===scoreMap(48,[{itemId:b.id,answer:"getting_there"}]).subjects.find(v=>v.subjectId===s.id)!.frontierDeltaMonths&&!pair)pair={subjectId:s.id,a:a.id,b:b.id};
  }
  assert.ok(pair);
  const result=buildProgressComparison(comparisonFixture([{itemId:pair.a,observedAt:"2026-01-01T12:00:00Z"},{itemId:pair.b,answer:"getting_there"}]),pair.subjectId);
  assert.equal(result.basisCount,2);assert.equal(result.basis.length,2);assert.equal(new Set(result.basis.map(b=>b.observedAt)).size,2);
});
test("taxonomy-only scoring cites teaching window, and family-local birthday matches projection", () => {
  const view=comparisonFixture([{itemId:"math.comparing-groups-more-or-fewer"}],{ageMonths:24});
  const result=buildProgressComparison(view,"math");assert.equal(result.status,"measured");assert.equal(result.basis[0]!.kind,"teaching_window");
  assert.equal(result.frontierDeltaMonths,view.scores.subjects.find(s=>s.subjectId==="math")!.frontierDeltaMonths);
  const boundary=comparisonFixture([{itemId:ball}],{birthDate:"2022-09-07",now:"2026-09-07T02:00:00Z",timeZone:"America/Los_Angeles"});
  assert.equal(progressComparisonAge(boundary),47);assert.equal(buildProgressComparison(boundary,"gross_motor").monthsAhead,11);
});
test("unverifiable score receipt refuses numbers; shared/native subject vocabulary stays number-free", () => {
  const view=comparisonFixture();view.scores.subjects.find(s=>s.subjectId==="gross_motor")!.monthsAhead=12;
  const result=buildProgressComparison(view,"gross_motor");assert.equal(result.status,"unavailable");assert.equal(result.displayLabel,null);
  const score=comparisonFixture().scores.subjects.find(s=>s.subjectId==="gross_motor")!;
  assert.equal(subjectLine(score,"Maya").numberLabel,"");
});
test("an unresolved conflict is excluded without borrowing either answer", () => {
 const view=comparisonFixture();
 const topic=view.subjects[0]!.domains.flatMap(d=>d.topics).find(t=>t.itemId===ball)!;
 view.subjects[0]!.domains.forEach(d=>d.topics=d.topics.filter(t=>t.itemId!==ball));
 const source={kind:"check_in" as const,derivation:"direct" as const,adultDisplayName:null,checkInId:null};
 view.conflicts=[{id:"conflict",childId:view.childId,familyId:"family",itemId:ball,adultAnswers:[{evidenceId:"a",adultDisplayName:null,answer:"easily",observedAt:topic.observedAt!,source},{evidenceId:"b",adultDisplayName:null,answer:"not_yet",observedAt:topic.observedAt!,source}],observedAt:topic.observedAt!,state:"open",resolvedAnswer:null,resolvedEvidenceId:null,resolvedAt:null}];
 view.scores=scoreMap(48,[]);
 const result=buildProgressComparison(view,"gross_motor");assert.equal(result.openConflicts,1);assert.equal(result.status,"unknown");assert.deepEqual(result.basis,[]);
});

test("a display cap on a lower checklist item does not claim the checklist is exhausted", () => {
 const result = comparison(36);
 assert.equal(result.limitReason, "display_cap");
 assert.equal(result.monthsAhead, 12); assert.equal(result.frontierDeltaMonths, 22);
 assert.equal(result.displayLabel, "At least 12 months ahead");
 assert.equal(comparison().limitReason, null);
});
