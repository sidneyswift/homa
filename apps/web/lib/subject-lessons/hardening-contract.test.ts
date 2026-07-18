import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  isValidSubjectLessonMaterial,
  SUBJECT_LESSON_MATERIAL_VALIDITY_SQL,
  type SubjectLessonMaterialValidityInput,
} from "./material-validity";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";

const validMaterial: SubjectLessonMaterialValidityInput = {
  subjectLessonId: LESSON_ID,
  childId: CHILD_ID,
  subject: "literacy",
  skill: "Reads short-vowel words",
  kind: "worksheet",
  status: "draft",
  pdfUrl: "https://example.com/worksheet.pdf",
  previewUrl: "https://example.com/worksheet.jpg",
  reviewPassed: true,
};

describe("subject lesson material validity", () => {
  it("accepts only an exact attached worksheet with usable URLs and eligible review", () => {
    const lesson = {
      id: LESSON_ID,
      childId: CHILD_ID,
      subjectId: "literacy",
      targetStatement: "Reads short-vowel words",
    };
    assert.equal(isValidSubjectLessonMaterial(lesson, validMaterial), true);
    assert.equal(
      isValidSubjectLessonMaterial(lesson, {
        ...validMaterial,
        reviewPassed: null,
      }),
      true
    );

    for (const invalid of [
      { ...validMaterial, subjectLessonId: null },
      { ...validMaterial, subjectLessonId: CHILD_ID },
      { ...validMaterial, childId: LESSON_ID },
      { ...validMaterial, subject: "Literacy" },
      { ...validMaterial, subject: "math" },
      { ...validMaterial, skill: "A different target" },
      { ...validMaterial, kind: "coloring" },
      { ...validMaterial, status: "superseded" },
      { ...validMaterial, pdfUrl: " " },
      { ...validMaterial, previewUrl: "" },
      { ...validMaterial, reviewPassed: false },
    ]) {
      assert.equal(
        isValidSubjectLessonMaterial(lesson, invalid),
        false,
        JSON.stringify(invalid)
      );
    }
  });

  it("keeps one shared SQL predicate for every database projection", () => {
    for (const fragment of [
      "material.subject_lesson_id = lesson.id",
      "material.child_id = lesson.child_id",
      "material.subject = lesson.subject_id",
      "material.skill = lesson.target_statement",
      "material.kind = 'worksheet'",
      "material.status in ('draft', 'final')",
      "nullif(btrim(material.pdf_url), '') is not null",
      "nullif(btrim(material.preview_url), '') is not null",
      "material.generation->'review'->'pass' = 'true'::jsonb",
    ]) {
      assert.match(
        SUBJECT_LESSON_MATERIAL_VALIDITY_SQL,
        new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u")
      );
    }
  });
});

describe("subject lesson provenance and owner effect boundary", () => {
  it("uses a server-stamped material foreign key instead of generation JSON", async () => {
    const [migration, artifactStore, createTool, store] = await Promise.all([
      readFile(
        new URL(
          "../../../../supabase/migrations/20260718150000_subject_lessons.sql",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL("../materials/artifact-store.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../../agent/tools/create_printable.ts", import.meta.url),
        "utf8"
      ),
      readFile(new URL("./store.ts", import.meta.url), "utf8"),
    ]);

    assert.match(
      migration,
      /add column subject_lesson_id uuid[\s\S]*references public\.subject_lessons \(id\)/u
    );
    assert.match(
      migration,
      /members add materials[\s\S]*subject_lesson_id is null/u
    );
    assert.match(artifactStore, /subjectLessonId: string \| null/u);
    assert.match(
      artifactStore,
      /subject_lesson_id[\s\S]*\$\{input\.subjectLessonId\}/u
    );
    assert.match(createTool, /subjectLessonId: trustedLesson\.lessonId/u);
    assert.doesNotMatch(store, /generation->'input'->>'lessonId'/u);
    assert.match(store, /SUBJECT_LESSON_MATERIAL_VALIDITY_SQL/gu);
  });

  it("blocks direct authenticated status updates and requires owner approval for lesson-linked rows", async () => {
    const [migration, isolation] = await Promise.all([
      readFile(
        new URL(
          "../../../../supabase/migrations/20260718150000_subject_lessons.sql",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL("../../../../scripts/isolation-check.mjs", import.meta.url),
        "utf8"
      ),
    ]);

    assert.match(
      migration,
      /create trigger enforce_material_status_write_boundary/u
    );
    assert.match(
      migration,
      /current_setting\(\s*'homa\.material_finalization_rpc',\s*true\s*\)/u
    );
    assert.match(
      migration,
      /target_row\.subject_lesson_id is not null[\s\S]*family_members[\s\S]*auth\.uid\(\)/u
    );
    assert.match(migration, /target_row\.subject_lesson_id is null/u);
    assert.match(
      isolation,
      /auth member cannot directly update material status/u
    );
    assert.match(
      isolation,
      /non-owner cannot finalize a lesson-linked material/u
    );
    assert.match(
      isolation,
      /auth member cannot forge subject lesson material provenance/u
    );
  });

  it("keeps lesson rows server-readable and hides nonfinal lesson materials from Data API reads", async () => {
    const [migration, isolation] = await Promise.all([
      readFile(
        new URL(
          "../../../../supabase/migrations/20260718150000_subject_lessons.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../../../../scripts/isolation-check.mjs", import.meta.url),
        "utf8",
      ),
    ]);

    assert.doesNotMatch(
      migration,
      /create policy "members read subject lessons"/u,
    );
    assert.doesNotMatch(
      migration,
      /grant select on table public\.subject_lessons to authenticated/u,
    );
    assert.match(
      migration,
      /members read their materials[\s\S]*subject_lesson_id is null[\s\S]*status = 'final'/u,
    );
    assert.match(isolation, /auth member cannot read subject lessons directly/u);
    assert.match(
      isolation,
      /auth member cannot read a lesson-linked draft material/u,
    );
    assert.match(
      isolation,
      /auth member can read a final lesson worksheet in Binder/u,
    );
  });

  it("protects generic pinned revision and finalization chains", async () => {
    const [artifactStore, library] = await Promise.all([
      readFile(
        new URL("../materials/artifact-store.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../materials/library.ts", import.meta.url), "utf8"),
    ]);

    assert.match(
      artifactStore,
      /prior\.subject_lesson_id is null/u,
    );
    assert.match(
      artifactStore,
      /pinnedMaterialRevisionAllowed/u,
    );
    assert.match(
      library,
      /trustedSubjectLessonId[\s\S]*subject_lesson_id/u,
    );
  });
});

describe("ready subject lesson projections", () => {
  it("uses the strict material predicate in ready transitions, reads, summaries, and Keep", async () => {
    const [store, mapStore, library] = await Promise.all([
      readFile(new URL("./store.ts", import.meta.url), "utf8"),
      readFile(new URL("../map/store.ts", import.meta.url), "utf8"),
      readFile(new URL("../materials/library.ts", import.meta.url), "utf8"),
    ]);

    const requiredStoreFunctions = [
      "finishSubjectLessonRun",
      "getSubjectLessonForFamily",
      "getSubjectLessonByToken",
      "getSubjectLessonStateByTokenForFamily",
      "listCurrentSubjectLessonSummaries",
      "attachSubjectLessonMaterialPinned",
      "recoverSubjectLessonMaterialPinned",
    ];
    for (const name of requiredStoreFunctions) {
      const start = store.indexOf(`export async function ${name}`);
      assert.ok(start >= 0, `${name} is missing`);
      const next = store.indexOf("export async function ", start + 1);
      const source = store.slice(start, next < 0 ? undefined : next);
      assert.match(
        source,
        /SUBJECT_LESSON_MATERIAL_VALIDITY_SQL/u,
        `${name} does not enforce material validity`
      );
    }
    assert.match(
      mapStore,
      /listReadySubjectLessonSummariesByReportToken[\s\S]*SUBJECT_LESSON_MATERIAL_VALIDITY_SQL/u
    );
    assert.match(
      library,
      /finalizeSubjectLessonMaterialPinned[\s\S]*SUBJECT_LESSON_MATERIAL_VALIDITY_SQL/u
    );
  });
});

describe("retention-only product shape", () => {
  it("contains no subject lesson completion or planner store shape", async () => {
    const [types, store, contracts, statusPolicy, migration, design] =
      await Promise.all([
        readFile(new URL("./types.ts", import.meta.url), "utf8"),
        readFile(new URL("./store.ts", import.meta.url), "utf8"),
        readFile(new URL("./route-contracts.ts", import.meta.url), "utf8"),
        readFile(new URL("./status-route-policy.ts", import.meta.url), "utf8"),
        readFile(
          new URL(
            "../../../../supabase/migrations/20260718150000_subject_lessons.sql",
            import.meta.url
          ),
          "utf8"
        ),
        readFile(
          new URL(
            "../../../../docs/superpowers/specs/2026-07-15-subject-lesson-with-worksheet-design.md",
            import.meta.url
          ),
          "utf8"
        ),
      ]);

    for (const source of [types, store, contracts, statusPolicy]) {
      assert.doesNotMatch(
        source,
        /completedAt|completeSubjectLesson|PlannerSubjectLesson|listPlannerSubjectLessons/u
      );
    }
    assert.doesNotMatch(migration, /completed_at|subject_lessons_planner_idx/u);
    assert.doesNotMatch(design, /### Planner and completion/u);
    assert.doesNotMatch(
      design,
      /subject lesson completion|completed_at|deep-dive/iu
    );
    assert.match(
      design,
      /report[\s\S]*lesson[\s\S]*worksheet[\s\S]*Keep[\s\S]*Binder[\s\S]*chat[\s\S]*phone settings/iu
    );
  });
});
