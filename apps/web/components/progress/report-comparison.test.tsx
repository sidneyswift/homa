import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ts from "typescript";

import { MAP_BANK_VERSION, MAP_SCORER_VERSION } from "@homa/core";

import { ReportView, type ReportViewData } from "../../app/onboarding/r/[token]/report-view";
import { comparisonFixture } from "../../lib/child-progress/comparison-fixture";
import { buildSavedReportComparisons } from "../../lib/child-progress/report-comparison";
import { CHILD_PROGRESS_PROJECTION_VERSION } from "../../lib/child-progress/view-schema";

const view = comparisonFixture([{ itemId: "gross_motor.catches-ball", observedAt: "2025-09-06T12:00:00Z", derivation: "inferred" }]);
const comparisons = buildSavedReportComparisons({
  childId: view.childId, scores: view.scores, generatedAt: view.projectedAt,
  bankVersion: MAP_BANK_VERSION, scorerVersion: MAP_SCORER_VERSION,
  scoredBirthDate: view.birthDate, scoredAgeMonths: 48, projection: view,
  projectionBankVersion: MAP_BANK_VERSION, projectionVersion: CHILD_PROGRESS_PROJECTION_VERSION,
  projectionDate: "2026-09-06", projectedAt: view.projectedAt,
});
const data: ReportViewData = {
  token: "synthetic-report", scores: view.scores, comparisons, bankVersion: MAP_BANK_VERSION,
  generatedAt: view.projectedAt, childName: view.childName, birthMonth: view.birthDate,
  parentFirstName: null, usState: null, familyId: "synthetic-family", childId: view.childId,
  answers: [{ itemId: "gross_motor.catches-ball", answer: "easily" }], history: [], eras: [], otherKids: [], plans: [], familyPhone: null,
};
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
function render(report: ReportViewData, progress = false, mirror = false) {
  return renderToStaticMarkup(<AppRouterContext.Provider value={router}>
    <ReportView data={report} mirror={mirror} viewerActions={{ call: false, month: false, lesson: false, progress }} />
  </AppRouterContext.Provider>);
}

test("actual full report subject row and drawer render the saved comparison and its dated basis", () => {
  const html = render(data);
  const section = html.slice(html.indexOf('id="subject-gross_motor"'));
  const summary = section.slice(0, section.indexOf("</summary>"));
  assert.match(summary, /About 10 months ahead/u);
  for (const text of ["About this comparison", "Sep 6, 2025", "Homa matched this from what was shared", "How this comparison works", "CDC"]) assert.ok(section.includes(text), text);
  assert.doesNotMatch(html, /See current Progress|saved basis for this report/u);
});

test("legacy report basis stays unavailable and current Progress link requires an authorized viewer", () => {
  const legacy = { ...data, comparisons: { status: "unavailable" } as const };
  const shared = render(legacy);
  assert.match(shared, /saved basis for this report&#x27;s comparison is unavailable/u);
  assert.match(shared, /Current checklist answers/u);
  assert.doesNotMatch(shared, /Questions I asked/u);
  assert.doesNotMatch(shared, /About 10 months ahead|At least 10 months ahead|See current Progress/u);
  assert.match(render(legacy, true), new RegExp(`/app/${view.childId}/progress\\?subject=gross_motor`, "u"));
  assert.doesNotMatch(render(legacy, true, true), /See current Progress/u);
});

test("actual token page keeps the current-Progress link behind family membership, flag and report lock", async () => {
  const source = readFileSync(new URL("../../app/onboarding/r/[token]/page.tsx", import.meta.url), "utf8");
  const declaration = source.slice(source.indexOf("export default async function ReportPage(")).replace("export default async function", "async function");
  const code = ts.transpileModule(declaration, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "createElement" } }).outputText;
  for (const scenario of [
    { actor: { family: { id: data.familyId }, memberUserId: "member" }, live: true, locked: false, expected: true },
    { actor: null, live: true, locked: false, expected: false },
    { actor: { family: { id: "other-family" }, memberUserId: "member" }, live: true, locked: false, expected: false },
    { actor: { family: { id: data.familyId }, memberUserId: null }, live: true, locked: false, expected: false },
    { actor: { family: { id: data.familyId }, memberUserId: "member" }, live: false, locked: false, expected: false },
    { actor: { family: { id: data.familyId }, memberUserId: "member" }, live: true, locked: true, expected: false },
    { actor: "auth-failure", live: true, locked: false, expected: false },
  ]) {
    const page = new Function("deps", `const {createElement,ReportView,getReportByToken,subjectLessonsEnabled,narrativeEnabled,requireFamilyWithActor,wallEnabled,reportLockEnabled,familyWallCheckout,freeReportSubjects,liveProgressEnabled}=deps;${code};return ReportPage;`)({
      createElement, ReportView, getReportByToken: async (token: string) => { assert.equal(token, data.token); return data; },
      subjectLessonsEnabled: () => false, narrativeEnabled: () => false,
      requireFamilyWithActor: async () => { if (scenario.actor === "auth-failure") throw new Error("unavailable"); return scenario.actor; },
      wallEnabled: () => scenario.locked, reportLockEnabled: () => scenario.locked,
      familyWallCheckout: async () => ({}), freeReportSubjects: () => [], liveProgressEnabled: () => scenario.live,
    });
    const element = await page({ params: Promise.resolve({ token: data.token }) }) as ReactElement<{ viewerActions: { progress: boolean } }>;
    assert.equal(element.props.viewerActions.progress, scenario.expected, JSON.stringify(scenario));
  }
});

test("taxonomy-backed report comparison does not call its saved evidence missing checklist answers", () => {
  const taxonomy = comparisonFixture([{ itemId: "math.comparing-groups-more-or-fewer" }], { ageMonths: 24 });
  const reading = buildSavedReportComparisons({
    childId: taxonomy.childId, scores: taxonomy.scores, generatedAt: taxonomy.projectedAt,
    bankVersion: MAP_BANK_VERSION, scorerVersion: MAP_SCORER_VERSION,
    scoredBirthDate: taxonomy.birthDate, scoredAgeMonths: 24, projection: taxonomy,
    projectionBankVersion: MAP_BANK_VERSION, projectionVersion: CHILD_PROGRESS_PROJECTION_VERSION,
    projectionDate: "2026-09-06", projectedAt: taxonomy.projectedAt,
  });
  const html = render({ ...data, scores: taxonomy.scores, birthMonth: taxonomy.birthDate, comparisons: reading, answers: [] });
  assert.match(html, /At least 8 months ahead/u);
  assert.match(html, /The saved evidence for this comparison appears above/u);
  assert.doesNotMatch(html, /href="gs:/u);
});
