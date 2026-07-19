import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  pinnedMaterialVisible,
  runPinnedMaterialReadWithCompatibility,
} from "./library";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";

describe("pinned material read privacy", () => {
  it("hides lesson-linked nonfinals while retaining ordinary drafts and final worksheets", () => {
    assert.equal(
      pinnedMaterialVisible({
        status: "draft",
        subjectLessonId: null,
      }),
      true,
    );
    for (const status of ["draft", "superseded"] as const) {
      assert.equal(
        pinnedMaterialVisible({
          status,
          subjectLessonId: LESSON_ID,
        }),
        false,
        status,
      );
    }
    assert.equal(
      pinnedMaterialVisible({
        status: "final",
        subjectLessonId: LESSON_ID,
      }),
      true,
    );
    assert.equal(
      pinnedMaterialVisible({
        status: "draft",
        subjectLessonId: null,
        finalOnly: true,
      }),
      false,
    );
  });

  it("selects legacy, protected, rollback, and fail-closed read modes safely", async () => {
    const calls: string[] = [];
    const run = async (input: {
      enabled: boolean;
      schemaPresent: boolean;
      protectedError?: { code: string; message: string };
    }) =>
      await runPinnedMaterialReadWithCompatibility({
        subjectLessonsEnabled: input.enabled,
        schemaPresent: input.schemaPresent,
        readLegacy: async () => {
          calls.push("legacy");
          return "legacy-result";
        },
        readProtected: async () => {
          calls.push("protected");
          if (input.protectedError) throw input.protectedError;
          return "protected-result";
        },
        failClosed: () => "hidden",
      });

    assert.equal(
      await run({ enabled: false, schemaPresent: false }),
      "legacy-result",
    );
    assert.deepEqual(calls.splice(0), ["legacy"]);

    assert.equal(
      await run({ enabled: true, schemaPresent: true }),
      "protected-result",
    );
    assert.deepEqual(calls.splice(0), ["protected"]);

    assert.equal(
      await run({ enabled: false, schemaPresent: true }),
      "protected-result",
    );
    assert.deepEqual(calls.splice(0), ["protected"]);

    for (const protectedError of [
      {
        code: "42703",
        message:
          'column "subject_lesson_id" of relation "materials" does not exist',
      },
      {
        code: "PGRST204",
        message:
          "Could not find the 'subject_lesson_id' column of 'materials' in the schema cache",
      },
    ]) {
      assert.equal(
        await run({
          enabled: false,
          schemaPresent: true,
          protectedError,
        }),
        "legacy-result",
      );
      assert.deepEqual(calls.splice(0), ["protected", "legacy"]);

      assert.equal(
        await run({
          enabled: true,
          schemaPresent: true,
          protectedError,
        }),
        "hidden",
      );
      assert.deepEqual(calls.splice(0), ["protected"]);
    }
  });

  it("applies the lesson privacy predicate to direct, card, and filtered pinned reads", async () => {
    const [librarySource, findToolSource, showToolSource] = await Promise.all([
      readFile(new URL("./library.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../../agent/tools/find_materials.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../../agent/tools/show_material.ts", import.meta.url),
        "utf8",
      ),
    ]);

    for (const functionName of [
      "getMaterialCardPinnedProtected",
      "getMaterialPinnedProtected",
      "findMaterialsPinnedProtected",
    ]) {
      const start = librarySource.indexOf(
        `async function ${functionName}`,
      );
      assert.ok(start >= 0, functionName);
      const next = librarySource.indexOf(
        "export async function ",
        start + 1,
      );
      const source = librarySource.slice(start, next < 0 ? undefined : next);
      assert.match(
        source,
        /subject_lesson_id is null[\s\S]*status = 'final'/u,
        functionName,
      );
    }

    assert.match(
      findToolSource,
      /channel === "subject_lesson"[\s\S]*finalOnly[\s\S]*"final"/u,
    );
    assert.match(
      findToolSource,
      /getMaterialPinned\([\s\S]*finalOnly/u,
    );
    assert.match(showToolSource, /getMaterialCardPinned/u);

    for (const legacyName of [
      "getMaterialCardPinnedLegacy",
      "getMaterialPinnedLegacy",
      "findMaterialsPinnedLegacy",
    ]) {
      const start = librarySource.indexOf(`async function ${legacyName}`);
      assert.ok(start >= 0, legacyName);
      const next = librarySource.indexOf("async function ", start + 1);
      const source = librarySource.slice(start, next < 0 ? undefined : next);
      assert.doesNotMatch(source, /subject_lesson_id/u, legacyName);
    }
    assert.match(
      librarySource,
      /materialSubjectLessonProvenanceExists[\s\S]*runPinnedMaterialReadWithCompatibility/u,
    );
  });

  it("selects pageCount and pagePreviewUrls on every pinned read path, legacy and protected alike", async () => {
    const librarySource = await readFile(
      new URL("./library.ts", import.meta.url),
      "utf8",
    );

    for (const functionName of [
      "getMaterialCardPinnedLegacy",
      "getMaterialCardPinnedProtected",
      "getMaterialPinnedLegacy",
      "getMaterialPinnedProtected",
      "findMaterialsPinnedLegacy",
      "findMaterialsPinnedProtected",
    ]) {
      const start = librarySource.indexOf(
        `async function ${functionName}`,
      );
      assert.ok(start >= 0, functionName);
      const next = librarySource.indexOf(
        "async function ",
        start + 1,
      );
      const source = librarySource.slice(start, next < 0 ? undefined : next);
      // A pinned-channel material row is the only route SMS/email/dispatch
      // and subject-lesson sessions have to page count and per-page
      // previews. The three "Protected" functions were added alongside
      // this branch's own subject_lesson_id gate and shipped without these
      // two columns, silently returning pageCount 1 / no previews for
      // every multi-page packet read through a pinned session, flag or no
      // flag, the moment the migration lands. Every read path, legacy and
      // protected, must select both.
      assert.match(
        source,
        /generation->'pageCount' as page_count/u,
        functionName,
      );
      assert.match(
        source,
        /generation->'pagePreviewUrls' as page_preview_urls/u,
        functionName,
      );
    }
  });
});
