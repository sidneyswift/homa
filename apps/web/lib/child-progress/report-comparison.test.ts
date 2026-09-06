import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

import { MAP_BANK_VERSION, MAP_SCORER_VERSION } from "@homa/core";

import { zonedDateString } from "../time-zone";
import { buildProgressComparison, canonicalComparisonAnswers, progressComparisonAge } from "./comparison";
import { comparisonFixture } from "./comparison-fixture";
import { buildSavedReportComparisons, type SavedReportProjection } from "./report-comparison";
import { CHILD_PROGRESS_PROJECTION_VERSION } from "./view-schema";

function savedFixture(): SavedReportProjection {
  const view = comparisonFixture([
    { itemId: "gross_motor.catches-ball", observedAt: "2025-09-06T12:00:00Z", derivation: "inferred" },
    { itemId: "gross_motor.gallops" },
  ]);
  return {
    childId: view.childId, scores: view.scores, generatedAt: view.projectedAt,
    bankVersion: MAP_BANK_VERSION, scorerVersion: MAP_SCORER_VERSION,
    scoredBirthDate: view.birthDate, scoredAgeMonths: progressComparisonAge(view),
    projection: view, projectionBankVersion: MAP_BANK_VERSION,
    projectionVersion: CHILD_PROGRESS_PROJECTION_VERSION,
    projectionDate: zonedDateString(new Date(view.projectedAt), view.timeZone), projectedAt: view.projectedAt,
  };
}

test("saved report comparison reuses the exact old projection and original evidence", () => {
  const input = savedFixture();
  const result = buildSavedReportComparisons(input);
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  const view = comparisonFixture([
    { itemId: "gross_motor.catches-ball", observedAt: "2025-09-06T12:00:00Z", derivation: "inferred" },
    { itemId: "gross_motor.gallops" },
  ]);
  assert.deepEqual(result.subjects.find(s => s.subjectId === "gross_motor"), buildProgressComparison(view, "gross_motor"));
  assert.equal(result.timeZone, "America/New_York");
  assert.deepEqual(result.answers, canonicalComparisonAnswers(view));
  assert.equal(result.answers.length, 2, "receipt carries every saved effective answer, not only frontier winners");
  const receipt = result.subjects.find(s => s.subjectId === "gross_motor")!;
  assert.equal(receipt.displayLabel, "About 10 months ahead");
  assert.equal(receipt.basis[0]!.observedAt, "2025-09-06T12:00:00Z");
  assert.equal(receipt.basis[0]!.derivation, "inferred");
});

test("report timestamp equality preserves microseconds and accepts equivalent offsets", () => {
  const input = savedFixture();
  assert.equal(buildSavedReportComparisons({ ...input, generatedAt: "2026-09-06T14:00:00.000000-04:00" }).status, "available");
  assert.equal(buildSavedReportComparisons({ ...input, generatedAt: "2026-09-06T18:00:00.000001Z" }).status, "unavailable");
});

test("missing legacy basis, different child, changed scores, date, birthday or version cannot borrow live evidence", () => {
  for (const patch of [
    { projection: null }, { projection: {} }, { childId: "other-child" },
    { bankVersion: "old-bank" }, { scorerVersion: null }, { scorerVersion: "old-scorer" },
    { scoredBirthDate: null }, { scoredBirthDate: "2022-08-01" }, { scoredAgeMonths: null }, { scoredAgeMonths: 49 },
    { projectionBankVersion: "old-bank" }, { projectionVersion: "old-projection" }, { projectionDate: "2026-09-07" },
    { projectedAt: null }, { projectedAt: "2026-09-07T18:00:00Z" }, { generatedAt: "2026-08-06T18:00:00Z" },
    { generatedAt: "bad-date" }, { scores: {} },
  ]) assert.deepEqual(buildSavedReportComparisons({ ...savedFixture(), ...patch }), { status: "unavailable" }, JSON.stringify(patch));
  const input = savedFixture();
  const view = input.projection as ReturnType<typeof comparisonFixture>;
  view.scores.subjects.find(s => s.subjectId === "gross_motor")!.monthsAhead = 15;
  input.scores = view.scores;
  assert.equal(buildSavedReportComparisons(input).status, "unavailable", "matching stored score objects still require canonical calculator parity");
});

test("saved family-local birthday basis does not use the current calendar date", () => {
  const view = comparisonFixture([{ itemId: "gross_motor.catches-ball" }], {
    birthDate: "2022-09-07", now: "2026-09-07T02:00:00Z", timeZone: "America/Los_Angeles",
  });
  const result = buildSavedReportComparisons({ ...savedFixture(), childId: view.childId,
    scores: view.scores, projection: view, generatedAt: view.projectedAt, projectedAt: view.projectedAt,
    scoredBirthDate: view.birthDate, scoredAgeMonths: 47, projectionDate: "2026-09-06" });
  assert.equal(result.status, "available");
  if (result.status === "available") assert.equal(result.subjects.find(s => s.subjectId === "gross_motor")!.displayLabel, "About 11 months ahead");
});

test("actual token report loader reads one scoped saved projection and never builds its comparison from current compatibility answers", async () => {
  const source = readFileSync(new URL("../map/store.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function getReportByToken(");
  const declaration = source.slice(start, source.indexOf("\nasync function touchFamily(", start)).replace("export async function", "async function");
  const code = ts.transpileModule(declaration, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const input = savedFixture(), calls: { text: string; values: unknown[] }[] = [];
  const view = input.projection as ReturnType<typeof comparisonFixture>;
  const row = { token: "synthetic-report-token", scores: input.scores, bank_version: input.bankVersion,
    generated_at: input.generatedAt, scorer_version: input.scorerVersion, scored_birth_date: input.scoredBirthDate,
    scored_age_months: input.scoredAgeMonths, saved_projection: input.projection,
    projection_bank_version: input.projectionBankVersion, projection_version: input.projectionVersion,
    projection_date: input.projectionDate, projected_at: input.projectedAt, viewed_at: input.generatedAt,
    history: [], narrative: null, narrative_meta: null, child_id: input.childId, child_name: view.childName,
    birth_month: view.birthDate, profile: {}, family_id: "synthetic-family", first_name: null, us_state: null };
  const sql = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.join("?").replace(/\s+/gu, " ").trim(); calls.push({ text, values });
    if (text.includes("left join public.child_progress_live live")) return [row];
    if (text.startsWith("select question_id, answer from public.child_answers")) return [{ question_id: "gross_motor.skips", answer: "easily" }];
    if (text.startsWith("select c.id,") || text.startsWith("select subject_id,") || text.startsWith("select phone_e164")) return [];
    throw new Error(`Unexpected SQL: ${text}`);
  };
  const getReport = new Function("deps", `const {mapDb,buildSavedReportComparisons,buildTrajectoryEras,getTrajectoryEvidence,profileInterestList,isInScoredRange,ageInMonths}=deps;${code};return getReportByToken;`)({
    mapDb: () => sql, buildSavedReportComparisons, buildTrajectoryEras: () => [], getTrajectoryEvidence: async () => [],
    profileInterestList: () => [], isInScoredRange: () => true, ageInMonths: () => 48,
  });
  const result = await getReport("synthetic-report-token", { stampFirstView: false });
  assert.deepEqual(result.comparisons, buildSavedReportComparisons(input));
  assert.deepEqual(result.answers, canonicalComparisonAnswers(view));
  assert.equal(calls.filter(c => c.text.startsWith("select question_id, answer from public.child_answers")).length, 0);
  assert.equal(result.comparisons.subjects.find((s: {subjectId: string}) => s.subjectId === "gross_motor").displayLabel, "About 10 months ahead");
  const initial = calls[0]!;
  assert.deepEqual(initial.values, ["synthetic-report-token"]);
  for (const scope of ["live.child_id = r.child_id", "live.family_id = f.id", "live.projected_at = r.generated_at", "r.token = ?", "r.revoked_at is null", "f.status <> 'deleted'"]) assert.ok(initial.text.includes(scope), scope);
  assert.equal(calls.filter(c => c.text.includes("child_progress_live")).length, 1);
  row.saved_projection = null;
  const legacy = await getReport("synthetic-report-token", { stampFirstView: false });
  assert.deepEqual(legacy.comparisons, { status: "unavailable" });
  assert.deepEqual(legacy.answers, [{ itemId: "gross_motor.skips", answer: "easily" }]);
});
