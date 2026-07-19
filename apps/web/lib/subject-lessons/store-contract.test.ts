import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { decodeSubjectLessonContent } from "./types";

const storeSourcePromise = readFile(
  new URL("./store.ts", import.meta.url),
  "utf8"
);
const typesSourcePromise = readFile(
  new URL("./types.ts", import.meta.url),
  "utf8"
);
const migrationSourcePromise = readFile(
  new URL(
    "../../../../supabase/migrations/20260718150000_subject_lessons.sql",
    import.meta.url
  ),
  "utf8"
);

function exportedFunctionSource(
  source: string,
  name: string,
  nextName: string
): string {
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(`export async function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} export is missing`);
  assert.notEqual(end, -1, `${nextName} export is missing`);
  return source.slice(start, end);
}

describe("subject lesson store contracts", () => {
  it("selects source facts only after the family-scoped child lock", async () => {
    const storeSource = await storeSourcePromise;
    const claimSource = exportedFunctionSource(
      storeSource,
      "claimOrReuseSubjectLesson",
      "claimSubjectLessonRun"
    );
    const transactionIndex = claimSource.indexOf("sql.begin");
    const childLockIndex = claimSource.indexOf("for update");
    const reportFactsIndex = claimSource.indexOf("select report.token");
    const answerFactsIndex = claimSource.indexOf(
      "left join public.child_answers answer"
    );
    const currentLessonIndex = claimSource.indexOf(
      "from public.subject_lessons lesson"
    );

    assert.ok(transactionIndex >= 0);
    assert.ok(childLockIndex > transactionIndex);
    assert.ok(reportFactsIndex > childLockIndex);
    assert.ok(answerFactsIndex > reportFactsIndex);
    assert.ok(currentLessonIndex > answerFactsIndex);
  });

  it("restores only a historical row matching the current target in reuse-only mode", async () => {
    const storeSource = await storeSourcePromise;
    const claimSource = exportedFunctionSource(
      storeSource,
      "claimOrReuseSubjectLesson",
      "claimSubjectLessonRun"
    );
    const currentMatch = claimSource.indexOf(
      "lockedCurrent?.source_fingerprint === sourceFingerprint"
    );
    const historicalLookup = claimSource.indexOf(
      "lesson.idempotency_key = ${sourceFingerprint}"
    );
    const reuseOnlyGuard = claimSource.indexOf(
      'if (!reusable && input.mode === "reuse-only") return null'
    );
    const supersession = claimSource.indexOf("set superseded_at = now()");
    const restoration = claimSource.indexOf("set superseded_at = null");
    const insertion = claimSource.indexOf("insert into public.subject_lessons");

    assert.match(claimSource, /mode\?: "create-or-reuse" \| "reuse-only"/u);
    assert.ok(currentMatch >= 0);
    assert.ok(historicalLookup > currentMatch);
    assert.ok(reuseOnlyGuard > historicalLookup);
    assert.ok(supersession > reuseOnlyGuard);
    assert.ok(restoration > supersession);
    assert.ok(insertion > restoration);
    assert.match(
      claimSource,
      /if \(!restored\) \{\s+throw new Error\("subject lesson restore lost its locked row"\)/u
    );
  });

  it("recovers only a server-stamped unattached worksheet before a retry returns", async () => {
    const storeSource = await storeSourcePromise;
    assert.match(
      storeSource,
      /export async function recoverSubjectLessonMaterialPinned/u
    );
    const claimRunSource = exportedFunctionSource(
      storeSource,
      "claimSubjectLessonRun",
      "setSubjectLessonRuntimeSession"
    );
    assert.match(
      claimRunSource,
      /retry[\s\S]*recoverSubjectLessonMaterialPinned/u
    );

    const recoverySource = exportedFunctionSource(
      storeSource,
      "recoverSubjectLessonMaterialPinned",
      "finishSubjectLessonRun"
    );
    assert.match(recoverySource, /lesson\.material_id is null/u);
    assert.match(recoverySource, /SUBJECT_LESSON_MATERIAL_VALIDITY_SQL/u);
    assert.match(
      recoverySource,
      /lesson\.attempt_count = \$\{input\.attempt\}/u
    );
    assert.doesNotMatch(recoverySource, /generation->'input'->>'lessonId'/u);
  });

  it("shares complete material validity across attachment and recovery", async () => {
    const storeSource = await storeSourcePromise;
    const predicateName = "SUBJECT_LESSON_MATERIAL_VALIDITY_SQL";
    assert.match(
      storeSource,
      new RegExp(
        `import[\\s\\S]*${predicateName}[\\s\\S]*material-validity`,
        "u"
      )
    );

    const sharedCondition = new RegExp(
      `\\$\\{sql\\.unsafe\\(${predicateName}\\)\\}`,
      "gu"
    );
    const attachmentSource = exportedFunctionSource(
      storeSource,
      "attachSubjectLessonMaterialPinned",
      "recoverSubjectLessonMaterialPinned"
    );
    const recoverySource = exportedFunctionSource(
      storeSource,
      "recoverSubjectLessonMaterialPinned",
      "finishSubjectLessonRun"
    );

    assert.equal((attachmentSource.match(sharedCondition) ?? []).length, 1);
    assert.equal((recoverySource.match(sharedCondition) ?? []).length, 2);
  });

  it("keeps token reads ready-only and projects no build internals", async () => {
    const [storeSource, typesSource] = await Promise.all([
      storeSourcePromise,
      typesSourcePromise,
    ]);
    const viewStart = typesSource.indexOf("export interface SubjectLessonView");
    const viewEnd = typesSource.indexOf(
      "export interface SubjectLessonSummary",
      viewStart
    );
    assert.ok(viewStart >= 0);
    assert.ok(viewEnd > viewStart);
    const viewSource = typesSource.slice(viewStart, viewEnd);
    assert.doesNotMatch(viewSource, /extends SubjectLessonRecord/u);
    for (const internalField of [
      "sourceFingerprint",
      "buildStatus",
      "buildPhase",
      "attemptCount",
      "idempotencyKey",
      "runtimeSessionId",
      "errorCode",
      "supersededAt",
      "updatedAt",
    ]) {
      assert.doesNotMatch(viewSource, new RegExp(internalField, "u"));
    }

    const tokenReadSource = exportedFunctionSource(
      storeSource,
      "getSubjectLessonByToken",
      "getSubjectLessonStateByTokenForFamily"
    );
    assert.match(tokenReadSource, /lesson\.build_status = 'ready'/u);
    assert.doesNotMatch(tokenReadSource, /SUBJECT_LESSON_COLUMNS/u);
    assert.doesNotMatch(tokenReadSource, /\.\.\.lesson/u);

    const ownerReadSource = exportedFunctionSource(
      storeSource,
      "getSubjectLessonStateByTokenForFamily",
      "listCurrentSubjectLessonSummaries"
    );
    assert.match(ownerReadSource, /child\.family_id = \$\{familyId\}/u);
    assert.match(ownerReadSource, /report\.token = \$\{token\}/u);
  });

  it("scopes runtime session writes to the claimed attempt", async () => {
    const storeSource = await storeSourcePromise;
    const sessionWriteSource = exportedFunctionSource(
      storeSource,
      "setSubjectLessonRuntimeSession",
      "saveSubjectLessonContentPinned"
    );

    assert.match(
      sessionWriteSource,
      /lessonId: string,\s+attempt: number,\s+sessionId: string,/u
    );
    assert.match(sessionWriteSource, /lesson\.attempt_count = \$\{attempt\}/u);
  });

  it("builds dispatch input from one family-scoped claim", async () => {
    const storeSource = await storeSourcePromise;
    const sessionInputSource = exportedFunctionSource(
      storeSource,
      "claimSubjectLessonSessionInput",
      "setSubjectLessonRuntimeSession"
    );

    assert.match(sessionInputSource, /child\.family_id = \$\{familyId\}/u);
    assert.equal(
      (
        sessionInputSource.match(
          /claimSubjectLessonRun\(familyId, lessonId, retry\)/gu
        ) ?? []
      ).length,
      1
    );
    assert.match(sessionInputSource, /attempt: lesson\.attemptCount/u);
    assert.match(
      sessionInputSource,
      /hasContent: isCompleteSubjectLessonContent\(lesson\.content\)/u
    );
    assert.match(sessionInputSource, /materialId: lesson\.materialId/u);
  });

  it("distinguishes an atomic terminal transition from a replay", async () => {
    const storeSource = await storeSourcePromise;
    const finishSource = exportedFunctionSource(
      storeSource,
      "finishSubjectLessonRun",
      "getSubjectLessonForFamily"
    );

    assert.match(
      finishSource,
      /Promise<FinishSubjectLessonRunResult \| null>/u
    );
    assert.match(
      finishSource,
      /lesson: toSubjectLessonRecord\(current\),\s+transitioned: false/u
    );
    assert.match(
      finishSource,
      /lesson: toSubjectLessonRecord\(updatedRows\[0\]\),\s+transitioned: true/u
    );
    assert.match(finishSource, /lesson\.attempt_count = \$\{input\.attempt\}/u);
  });

  it("loads retry identity only through the pinned family and current report", async () => {
    const storeSource = await storeSourcePromise;
    const routeReadSource = exportedFunctionSource(
      storeSource,
      "getSubjectLessonForFamily",
      "getSubjectLessonByToken"
    );

    assert.ok(
      routeReadSource.indexOf("if (!subjectLessonsEnabled()) return null") <
        routeReadSource.indexOf("mapDb()")
    );
    assert.match(routeReadSource, /child\.family_id = \$\{familyId\}/u);
    assert.match(routeReadSource, /lesson\.id = \$\{lessonId\}/u);
    assert.match(routeReadSource, /report\.revoked_at is null/u);
    assert.match(routeReadSource, /lesson\.superseded_at is null/u);
  });

  it("does not expose completion or planner mutations and projections", async () => {
    const [storeSource, typesSource, migrationSource] = await Promise.all([
      storeSourcePromise,
      typesSourcePromise,
      migrationSourcePromise,
    ]);

    for (const source of [storeSource, typesSource]) {
      assert.doesNotMatch(
        source,
        /completeSubjectLesson|completedAt|PlannerSubjectLesson|listPlannerSubjectLessons/u
      );
    }
    assert.doesNotMatch(
      migrationSource,
      /completed_at|subject_lessons_planner_idx/u
    );
  });

  it("returns bounded identities only for stale rows transitioned in this sweep", async () => {
    const storeSource = await storeSourcePromise;
    const start = storeSource.indexOf(
      "export async function reapStaleSubjectLessons"
    );
    assert.ok(start >= 0);
    const reaperSource = storeSource.slice(start);

    assert.match(
      reaperSource,
      /Promise<StaleSubjectLessonTransitionReceipt\[\]>/u
    );
    assert.ok(
      reaperSource.indexOf("if (!subjectLessonsEnabled()) return []") <
        reaperSource.indexOf("mapDb()")
    );
    assert.match(reaperSource, /lesson\.build_status = 'running'/u);
    assert.match(reaperSource, /limit 100/u);
    assert.match(reaperSource, /for update of lesson skip locked/u);
    assert.match(reaperSource, /set build_status = 'failed'/u);
    assert.match(reaperSource, /error_code = 'stale_run'/u);
    for (const field of ["family_id", "child_id", "subject", "attempt"]) {
      assert.match(reaperSource, new RegExp(`returning[\\s\\S]*${field}`, "u"));
    }
    assert.match(reaperSource, /errorCode: "stale_run"/u);
  });

  it("decodes stored content and rejects non-string array entries", () => {
    const valid = {
      title: "Compare two groups",
      materials: ["Counters"],
      steps: ["Make two groups", "Count each group", "Name which has more"],
      practice: "Compare two snack groups.",
    };

    assert.deepEqual(decodeSubjectLessonContent(valid), valid);
    assert.deepEqual(
      decodeSubjectLessonContent({
        title: "",
        materials: [],
        steps: [],
        practice: "",
      }),
      {
        title: "",
        materials: [],
        steps: [],
        practice: "",
      }
    );
    assert.equal(
      decodeSubjectLessonContent({ ...valid, materials: ["Counters", 2] }),
      null
    );
    assert.equal(
      decodeSubjectLessonContent({ ...valid, steps: [valid.steps[0], null] }),
      null
    );
    assert.equal(decodeSubjectLessonContent(null), null);
  });

  it("checks string arrays in Postgres and decodes unknown store rows", async () => {
    const [storeSource, migrationSource] = await Promise.all([
      storeSourcePromise,
      migrationSourcePromise,
    ]);

    assert.match(
      storeSource,
      /interface SubjectLessonSqlRow[\s\S]*content: unknown;/u
    );
    assert.match(storeSource, /decodeSubjectLessonContent\(row\.content\)/u);
    assert.ok(
      migrationSource.includes(
        "not (content @? '$.materials[*] ? (@.type() != \"string\")')"
      )
    );
    assert.ok(
      migrationSource.includes(
        "not (content @? '$.steps[*] ? (@.type() != \"string\")')"
      )
    );
  });

  it("allows the internal lesson channel in material and usage receipts", async () => {
    const migrationSource = await migrationSourcePromise;

    assert.match(
      migrationSource,
      /alter table public\.materials[\s\S]*add constraint materials_channel_check[\s\S]*'subject_lesson'/u
    );
    assert.match(
      migrationSource,
      /alter table public\.model_usage[\s\S]*add constraint model_usage_channel_check[\s\S]*'subject_lesson'/u
    );
  });
});
