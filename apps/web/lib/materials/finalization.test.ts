import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { pinnedMaterialRevisionAllowed } from "./artifact-store";
import {
  finalizeMaterialCaller,
  isMissingSubjectLessonProvenanceColumn,
  planMaterialFinalization,
  planSubjectLessonMaterialFinalization,
} from "./library";

const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const LESSON_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_LESSON_ID = "55555555-5555-4555-8555-555555555555";

const draftChain = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    status: "draft" as const,
    revises: null,
    pdf_url: "https://example.com/old.pdf",
    preview_url: "https://example.com/old.jpg",
    title: "First draft",
    approved_at: null,
  },
  {
    id: TARGET_ID,
    status: "draft" as const,
    revises: "11111111-1111-4111-8111-111111111111",
    pdf_url: "https://example.com/current.pdf",
    preview_url: "https://example.com/current.jpg",
    title: "Current worksheet",
    approved_at: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    status: "final" as const,
    revises: TARGET_ID,
    pdf_url: "https://example.com/later.pdf",
    preview_url: "https://example.com/later.jpg",
    title: "Later version",
    approved_at: "2026-07-15T12:00:00.000Z",
  },
];

describe("material finalization transition receipts", () => {
  it("plans cleanup and supersession only for the first draft-to-final transition", () => {
    const first = planMaterialFinalization(draftChain, TARGET_ID);

    assert.deepEqual(first.result, {
      finalized: true,
      transitioned: true,
      title: "Current worksheet",
      versionsSuperseded: 2,
      note: "Final version kept; earlier drafts tidied away.",
    });
    assert.deepEqual(first.supersededRows.map((row) => row.id).sort(), [
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
    ]);
    assert.deepEqual(
      first.draftRowsToDelete.map((row) => row.id),
      ["11111111-1111-4111-8111-111111111111"]
    );

    const afterFirst = draftChain.map((row) => ({
      ...row,
      status:
        row.id === TARGET_ID ? ("final" as const) : ("superseded" as const),
      approved_at:
        row.id === TARGET_ID ? "2026-07-16T12:00:00.000Z" : row.approved_at,
    }));
    const second = planMaterialFinalization(afterFirst, TARGET_ID);

    assert.deepEqual(second.result, {
      finalized: true,
      transitioned: false,
      title: "Current worksheet",
      versionsSuperseded: 0,
      note: "This material is already kept as the final version.",
    });
    assert.deepEqual(second.supersededRows, []);
    assert.deepEqual(second.draftRowsToDelete, []);
  });

  it("preserves agent approval of another version after an earlier finalization", () => {
    const plan = planMaterialFinalization(
      draftChain.map((row) =>
        row.id === TARGET_ID
          ? {
              ...row,
              status: "superseded" as const,
              approved_at: "2026-07-14T12:00:00.000Z",
            }
          : row
      ),
      TARGET_ID
    );

    assert.equal(plan.result.finalized, true);
    assert.equal(plan.result.transitioned, true);
    assert.equal(plan.result.versionsSuperseded, 2);
    assert.deepEqual(plan.supersededRows.map((row) => row.id).sort(), [
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
    ]);
  });

  it("rejects every generic pinned attempt touching a lesson-linked chain", () => {
    const protectedChain = draftChain.map((row, index) => ({
      ...row,
      subject_lesson_id: index === 0 ? LESSON_ID : null,
    }));

    for (const channel of ["sms", "email", "dispatch"] as const) {
      const plan = planMaterialFinalization(protectedChain, TARGET_ID);
      assert.equal(plan.result.finalized, false, channel);
      assert.match(plan.result.note, /lesson Keep action/iu, channel);
      assert.equal(
        pinnedMaterialRevisionAllowed({
          channel,
          subjectLessonId: null,
          revisionSubjectLessonId: LESSON_ID,
        }),
        false,
        channel,
      );
    }
  });

  it("allows only an explicit exact-lesson option to finalize a protected chain", () => {
    const protectedChain = draftChain.map((row) => ({
      ...row,
      subject_lesson_id: LESSON_ID,
    }));
    const trusted = planSubjectLessonMaterialFinalization(
      protectedChain,
      TARGET_ID,
      "draft",
      LESSON_ID,
    );
    assert.ok(trusted);
    assert.equal(trusted.result.finalized, true);

    assert.equal(
      planSubjectLessonMaterialFinalization(
        protectedChain,
        TARGET_ID,
        "draft",
        OTHER_LESSON_ID,
      ),
      null,
    );
    assert.equal(
      planSubjectLessonMaterialFinalization(
        protectedChain.map((row, index) => ({
          ...row,
          subject_lesson_id:
            index === 0 ? OTHER_LESSON_ID : LESSON_ID,
        })),
        TARGET_ID,
        "draft",
        LESSON_ID,
      ),
      null,
    );
    assert.equal(
      pinnedMaterialRevisionAllowed({
        channel: "subject_lesson",
        subjectLessonId: LESSON_ID,
        revisionSubjectLessonId: LESSON_ID,
      }),
      true,
    );
  });

  it("rejects an attached approved superseded revision from direct lesson Keep", () => {
    const approvedSupersededChain = draftChain.map((row) =>
      row.id === TARGET_ID
        ? {
            ...row,
            status: "superseded" as const,
            approved_at: "2026-07-14T12:00:00.000Z",
          }
        : row
    );
    const before = structuredClone(approvedSupersededChain);

    const plan = planSubjectLessonMaterialFinalization(
      approvedSupersededChain,
      TARGET_ID,
      "superseded",
      LESSON_ID,
    );

    assert.equal(plan, null);
    assert.deepEqual(approvedSupersededChain, before);
  });

  it("rejects a superseded draft whose Blob bytes may have been deleted", () => {
    const plan = planMaterialFinalization(
      draftChain.map((row) =>
        row.id === TARGET_ID
          ? {
              ...row,
              status: "superseded" as const,
              approved_at: null,
            }
          : row
      ),
      TARGET_ID
    );

    assert.deepEqual(plan.result, {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: "That material was replaced before it was kept.",
    });
    assert.deepEqual(plan.supersededRows, []);
    assert.deepEqual(plan.draftRowsToDelete, []);
  });

  it("plans the complete revision chain without leaving another final candidate", () => {
    const longChain = Array.from({ length: 55 }, (_, index) => ({
      id: `material-${index}`,
      status: "draft" as const,
      revises: index === 0 ? null : `material-${index - 1}`,
      pdf_url: `https://example.com/${index}.pdf`,
      preview_url: `https://example.com/${index}.jpg`,
      title: `Version ${index}`,
      approved_at: null,
    }));

    const plan = planMaterialFinalization(longChain, "material-54");

    assert.equal(plan.result.versionsSuperseded, 54);
    assert.equal(plan.supersededRows.length, 54);
    assert.equal(plan.draftRowsToDelete.length, 54);
  });

  it("uses one caller-JWT RPC and cleans draft URLs only after its receipt", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    let rpcCommitted = false;
    const cleanedUrls: string[][] = [];
    const db = {
      async rpc(name: string, args: unknown) {
        calls.push({ name, args });
        rpcCommitted = true;
        return {
          data: [
            {
              finalized: true,
              transitioned: true,
              title: "Current worksheet",
              versions_superseded: 1,
              draft_urls: [
                "https://example.com/old.pdf",
                "https://example.com/old.jpg",
              ],
            },
          ],
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const result = await finalizeMaterialCaller(
      db,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      TARGET_ID,
      async (urls) => {
        assert.equal(rpcCommitted, true);
        cleanedUrls.push([...urls]);
      }
    );

    assert.deepEqual(calls, [
      {
        name: "finalize_family_material",
        args: {
          p_family_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          p_material_id: TARGET_ID,
        },
      },
    ]);
    assert.deepEqual(result, {
      finalized: true,
      transitioned: true,
      title: "Current worksheet",
      versionsSuperseded: 1,
      note: "Final version kept; earlier drafts tidied away.",
    });
    assert.deepEqual(cleanedUrls, [
      ["https://example.com/old.pdf", "https://example.com/old.jpg"],
    ]);
  });

  it("does not clean or claim a transition for RPC replay and rejection", async () => {
    for (const receipt of [
      {
        finalized: true,
        transitioned: false,
        title: "Current worksheet",
        versions_superseded: 0,
        draft_urls: [],
      },
      {
        finalized: false,
        transitioned: false,
        title: null,
        versions_superseded: 0,
        draft_urls: [],
      },
    ]) {
      let cleanups = 0;
      const db = {
        rpc: async () => ({ data: [receipt], error: null }),
      } as unknown as SupabaseClient;
      const result = await finalizeMaterialCaller(
        db,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        TARGET_ID,
        async () => {
          cleanups += 1;
        }
      );

      assert.equal(result.transitioned, false);
      assert.equal(result.finalized, receipt.finalized);
      assert.equal(cleanups, 0);
    }
  });

  it("preserves legacy caller approval only when the lesson flag is off and the RPC is missing", async () => {
    const updates: Array<Record<string, unknown>> = [];
    let fromCalls = 0;
    const db = {
      rpc: async () => ({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.finalize_family_material",
        },
      }),
      from(table: string) {
        assert.equal(table, "materials");
        fromCalls += 1;
        let operation: "select" | "update" = "select";
        let update: Record<string, unknown> | null = null;
        const builder = {
          select() {
            operation = "select";
            return builder;
          },
          update(changes: Record<string, unknown>) {
            operation = "update";
            update = changes;
            return builder;
          },
          eq() {
            return builder;
          },
          in() {
            return builder;
          },
          then(
            resolve: (value: unknown) => unknown,
            reject: (reason: unknown) => unknown
          ) {
            const value =
              operation === "select"
                ? {
                    data: [
                      {
                        id: TARGET_ID,
                        status: "draft",
                        revises: null,
                        pdf_url: "https://example.com/current.pdf",
                        preview_url: "https://example.com/current.jpg",
                        title: "Current worksheet",
                        approved_at: null,
                      },
                    ],
                    error: null,
                  }
                : { data: null, error: null };
            if (update) updates.push(update);
            return Promise.resolve(value).then(resolve, reject);
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    const result = await finalizeMaterialCaller(
      db,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      TARGET_ID,
      async () => {},
      () => false
    );

    assert.equal(result.finalized, true);
    assert.equal(result.transitioned, true);
    assert.equal(fromCalls > 0, true);
    assert.deepEqual(updates, [
      {
        status: "final",
        approved_at: updates[0]?.approved_at,
      },
    ]);
    assert.equal(typeof updates[0]?.approved_at, "string");
  });

  it("fails closed instead of using legacy caller writes when the lesson flag is on", async () => {
    let fromCalls = 0;
    const db = {
      rpc: async () => ({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.finalize_family_material",
        },
      }),
      from() {
        fromCalls += 1;
        throw new Error("legacy writes must stay closed");
      },
    } as unknown as SupabaseClient;

    const result = await finalizeMaterialCaller(
      db,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      TARGET_ID,
      async () => {},
      () => true
    );

    assert.equal(result.finalized, false);
    assert.equal(result.transitioned, false);
    assert.equal(fromCalls, 0);
  });

  it("does not treat ordinary RPC errors as migration compatibility", async () => {
    let fromCalls = 0;
    const db = {
      rpc: async () => ({
        data: null,
        error: { code: "42501", message: "Family access denied" },
      }),
      from() {
        fromCalls += 1;
        throw new Error("legacy writes must stay closed");
      },
    } as unknown as SupabaseClient;

    const result = await finalizeMaterialCaller(
      db,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      TARGET_ID,
      async () => {},
      () => false
    );

    assert.equal(result.finalized, false);
    assert.equal(fromCalls, 0);
  });

  it("recognizes realistic missing provenance-column responses in either message order", () => {
    for (const error of [
      {
        code: "PGRST204",
        message:
          "Could not find the 'subject_lesson_id' column of 'materials' in the schema cache",
      },
      {
        code: "42703",
        message:
          'column materials.subject_lesson_id does not exist',
      },
      {
        code: "42703",
        message:
          'materials.subject_lesson_id: column does not exist',
      },
      {
        code: "42703",
        message:
          'column "subject_lesson_id" of relation "materials" does not exist',
      },
    ]) {
      assert.equal(
        isMissingSubjectLessonProvenanceColumn(error),
        true,
        error.message,
      );
    }
    assert.equal(
      isMissingSubjectLessonProvenanceColumn({
        code: "42703",
        message: 'column "unrelated" does not exist',
      }),
      false,
    );
  });

  it("preserves legacy approval when the realistic provenance probe reports a missing column", async () => {
    for (const provenanceError of [
      {
        code: "PGRST204",
        message:
          "Could not find the 'subject_lesson_id' column of 'materials' in the schema cache",
      },
      {
        code: "42703",
        message:
          'column "subject_lesson_id" of relation "materials" does not exist',
      },
      {
        code: "42703",
        message:
          'materials.subject_lesson_id: column does not exist',
      },
    ]) {
      const db = {
        rpc: async () => ({
          data: null,
          error: {
            code: "PGRST202",
            message:
              "Could not find the function public.finalize_family_material",
          },
        }),
        from() {
          let operation: "select" | "update" = "select";
          let columns = "";
          const builder = {
            select(nextColumns: string) {
              operation = "select";
              columns = nextColumns;
              return builder;
            },
            update() {
              operation = "update";
              return builder;
            },
            eq() {
              return builder;
            },
            in() {
              return builder;
            },
            then(
              resolve: (value: unknown) => unknown,
              reject: (reason: unknown) => unknown,
            ) {
              const value =
                operation === "update"
                  ? { data: null, error: null }
                  : columns.includes("subject_lesson_id")
                    ? { data: null, error: provenanceError }
                    : {
                        data: [{
                          id: TARGET_ID,
                          status: "draft",
                          revises: null,
                          pdf_url: "https://example.com/current.pdf",
                          preview_url: "https://example.com/current.jpg",
                          title: "Current worksheet",
                          approved_at: null,
                        }],
                        error: null,
                      };
              return Promise.resolve(value).then(resolve, reject);
            },
          };
          return builder;
        },
      } as unknown as SupabaseClient;

      const result = await finalizeMaterialCaller(
        db,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        TARGET_ID,
        async () => {},
        () => false,
      );
      assert.equal(result.finalized, true, provenanceError.message);
      assert.equal(result.transitioned, true, provenanceError.message);
    }
  });

  it("uses one atomic pinned path for agent approval and lesson Keep", async () => {
    const [librarySource, migrationSource, storeSource, toolSource] =
      await Promise.all([
        readFile(new URL("./library.ts", import.meta.url), "utf8"),
        readFile(
          new URL(
            "../../../../supabase/migrations/20260718150000_subject_lessons.sql",
            import.meta.url
          ),
          "utf8"
        ),
        readFile(
          new URL("../subject-lessons/store.ts", import.meta.url),
          "utf8"
        ),
        readFile(
          new URL("../../agent/tools/mark_material_final.ts", import.meta.url),
          "utf8"
        ),
      ]);

    const callerStart = librarySource.indexOf(
      "export async function finalizeMaterialCaller"
    );
    assert.ok(callerStart >= 0);
    const callerSource = librarySource.slice(callerStart);
    assert.match(callerSource, /\.rpc\("finalize_family_material"/u);
    assert.doesNotMatch(callerSource, /\.from\("materials"\)/u);

    const rpcStart = migrationSource.indexOf(
      "create or replace function public.finalize_family_material"
    );
    assert.ok(rpcStart >= 0);
    const rpcSource = migrationSource.slice(rpcStart);
    assert.match(rpcSource, /security invoker/u);
    assert.doesNotMatch(rpcSource, /security definer/u);
    assert.match(rpcSource, /auth\.uid\(\) is null/u);
    assert.match(rpcSource, /not public\.is_family_member\(p_family_id\)/u);
    assert.match(rpcSource, /for update/u);
    assert.match(
      rpcSource,
      /target_row\.status = 'superseded'[\s\S]*target_row\.approved_at is null/u
    );
    assert.match(rpcSource, /draft_urls/u);
    const targetUpdate = rpcSource.indexOf("set status = 'final'");
    const siblingUpdate = rpcSource.indexOf("set status = 'superseded'");
    const transitionReceipt = rpcSource.search(
      /return query\s+select true, true/u
    );
    assert.ok(targetUpdate >= 0);
    assert.ok(siblingUpdate > targetUpdate);
    assert.ok(transitionReceipt > siblingUpdate);
    assert.match(
      rpcSource,
      /revoke all on function public\.finalize_family_material\(uuid, uuid\) from public/u
    );
    assert.match(
      rpcSource,
      /grant execute on function public\.finalize_family_material\(uuid, uuid\) to authenticated/u
    );

    assert.match(
      librarySource,
      /export async function finalizeSubjectLessonMaterialPinned/u
    );
    const pinnedStart = librarySource.indexOf(
      "export async function finalizeMaterialInTransaction"
    );
    const directKeepStart = librarySource.indexOf(
      "export interface SubjectLessonMaterialFinalization",
      pinnedStart
    );
    const pinnedSource = librarySource.slice(pinnedStart, directKeepStart);
    assert.match(
      pinnedSource,
      /planMaterialFinalization\(rows, materialId, precondition\)/u,
    );
    assert.doesNotMatch(pinnedSource, /trustedSubjectLessonId/u);
    assert.match(
      librarySource,
      /finalizeSubjectLessonMaterialPinned[\s\S]*lesson\.build_status = 'ready'/u
    );
    assert.match(
      librarySource,
      /planSubjectLessonMaterialFinalization\([\s\S]*lessonId/u,
    );
    assert.match(librarySource, /lesson\.superseded_at is null/u);
    assert.match(librarySource, /SUBJECT_LESSON_MATERIAL_VALIDITY_SQL/u);
    assert.match(librarySource, /child\.family_id = \$\{familyId\}/u);
    assert.match(librarySource, /applyPinnedMaterialFinalization/u);
    assert.match(
      storeSource,
      /keepSubjectLessonMaterialWithReceipt[\s\S]*finalizeSubjectLessonMaterialPinned/u
    );
    assert.match(toolSource, /if \(result\.transitioned\)/u);
    assert.doesNotMatch(
      toolSource,
      /if \(!result\.finalized\) return result;\s+await emitMapEvent/u
    );
  });
});
