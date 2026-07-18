import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { planSubjectLessonContentSave } from "./content-save";
import {
  resolveSubjectLessonWorksheetEffect,
  subjectLessonWorksheetCreateKey,
  type SubjectLessonWorksheetMaterialReceipt,
} from "./worksheet-effect";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const MATERIAL_ID = "22222222-2222-4222-8222-222222222222";
const REVISION_ID = "33333333-3333-4333-8333-333333333333";

const materialReceipt: SubjectLessonWorksheetMaterialReceipt = {
  id: MATERIAL_ID,
  title: "Short-vowel practice",
  kind: "worksheet",
  skill: "Reads short-vowel words",
  childName: "Maya",
  previewUrl: "https://example.com/worksheet.jpg",
  pdfUrl: "https://example.com/worksheet.pdf",
  status: "draft",
};

describe("replay-safe subject lesson worksheet effects", () => {
  it("creates once, refuses an uncertain replay, and returns a completed receipt", async () => {
    let receiptState: "none" | "in_flight" | "completed" = "none";
    let billableCreates = 0;
    const run = () => {
      const claim =
        receiptState === "completed"
          ? { status: "completed" as const, material: materialReceipt }
          : receiptState === "in_flight"
            ? { status: "in_flight" as const }
            : { status: "claimed" as const };
      if (receiptState === "none") receiptState = "in_flight";
      const effect = resolveSubjectLessonWorksheetEffect(claim);
      if (effect.status !== "create") return effect;
      billableCreates += 1;
      return { status: "created" as const, material: materialReceipt };
    };

    assert.deepEqual(run(), {
      status: "created",
      material: materialReceipt,
    });
    assert.equal(billableCreates, 1);
    assert.deepEqual(run(), { status: "refused" });
    assert.equal(billableCreates, 1);

    receiptState = "completed";
    assert.deepEqual(run(), {
      status: "completed",
      material: materialReceipt,
    });
    assert.equal(billableCreates, 1);
  });

  it("gives explicit retry attempts and review revisions distinct durable keys", () => {
    assert.equal(subjectLessonWorksheetCreateKey(null), "initial");
    assert.equal(subjectLessonWorksheetCreateKey(REVISION_ID), REVISION_ID);

    const keys = new Set([
      `${LESSON_ID}:1:${subjectLessonWorksheetCreateKey(null)}`,
      `${LESSON_ID}:2:${subjectLessonWorksheetCreateKey(null)}`,
      `${LESSON_ID}:2:${subjectLessonWorksheetCreateKey(REVISION_ID)}`,
    ]);
    assert.equal(keys.size, 3);
  });
});

describe("write-once subject lesson content", () => {
  const content = {
    title: "Short vowels at home",
    materials: ["Letter tiles"],
    steps: ["Maya names each sound.", "Maya builds map.", "Maya reads map."],
    practice: "Tomorrow, Maya builds and reads sat.",
  };

  it("writes the first complete save and reuses only exact later content", () => {
    assert.equal(
      planSubjectLessonContentSave(
        {
          title: "",
          materials: [],
          steps: [],
          practice: "",
        },
        content
      ),
      "write"
    );
    assert.equal(
      planSubjectLessonContentSave(structuredClone(content), content),
      "reuse"
    );
    assert.equal(
      planSubjectLessonContentSave(content, {
        ...content,
        title: "Replacement title",
      }),
      "reject"
    );
  });
});

describe("worksheet effect storage contracts", () => {
  it("claims before render, review, or Blob upload and completes only after attachment", async () => {
    const [toolSource, storeSource, migrationSource] = await Promise.all([
      readFile(
        new URL("../../agent/tools/create_printable.ts", import.meta.url),
        "utf8"
      ),
      readFile(new URL("./store.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../../../supabase/migrations/20260715210000_subject_lessons.sql",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

    const claim = toolSource.indexOf(
      "const worksheetEffect = resolveSubjectLessonWorksheetEffect"
    );
    assert.ok(claim >= 0);
    for (const billedStep of [
      "renderPrintableHtml",
      "reviewArtifact",
      "uploadMaterialArtifacts",
    ]) {
      assert.ok(
        toolSource.indexOf(billedStep, claim) > claim,
        `${billedStep} must follow the durable claim`
      );
    }

    assert.match(
      migrationSource,
      /create table public\.subject_lesson_effect_receipts/u
    );
    assert.match(
      migrationSource,
      /primary key \(subject_lesson_id, attempt, create_key\)/u
    );
    assert.match(
      storeSource,
      /insert into public\.subject_lesson_effect_receipts[\s\S]*on conflict do nothing/u
    );
    const claimStart = storeSource.indexOf(
      "export async function claimSubjectLessonWorksheetEffectPinned",
    );
    const revisionPreflight = storeSource.indexOf(
      "const revisionEligible",
      claimStart,
    );
    const receiptInsert = storeSource.indexOf(
      "insert into public.subject_lesson_effect_receipts",
      claimStart,
    );
    assert.ok(revisionPreflight > claimStart);
    assert.ok(receiptInsert > revisionPreflight);
    const preflightSource = storeSource.slice(
      revisionPreflight,
      receiptInsert,
    );
    for (const predicate of [
      /material\.family_id = child\.family_id/u,
      /material\.subject_lesson_id = lesson\.id/u,
      /material\.child_id = lesson\.child_id/u,
      /material\.subject = lesson\.subject_id/u,
      /material\.skill = lesson\.target_statement/u,
      /material\.kind = 'worksheet'/u,
      /material\.status = 'draft'/u,
    ]) {
      assert.match(preflightSource, predicate);
    }

    const attachStart = storeSource.indexOf(
      "export async function attachSubjectLessonMaterialPinned"
    );
    const recoverStart = storeSource.indexOf(
      "export async function recoverSubjectLessonMaterialPinned",
      attachStart
    );
    const attachmentSource = storeSource.slice(attachStart, recoverStart);
    const attachWrite = attachmentSource.indexOf(
      "set material_id = material.id"
    );
    const receiptWrite = attachmentSource.indexOf(
      "update public.subject_lesson_effect_receipts"
    );
    assert.ok(attachWrite >= 0);
    assert.ok(receiptWrite > attachWrite);
  });
});
