import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import type postgres from "postgres";

import { EVAL_FIXTURE_PACKET_ID } from "../family-context-eval-fixture";
import { findMaterialsCaller, findMaterialsPinned, type MaterialFilters } from "./library";

/** Actual Supabase query construction and PostgreSQL/RLS, using a narrow
 * SELECT adapter in place of the hosted PostgREST HTTP process. */
function callerOnPostgres(sql: postgres.Sql, userId: string) {
  const columns = new Set(["id", "title", "kind", "status", "source", "skill", "subject", "curriculum", "theme", "characters", "child_id", "preview_url", "pdf_url", "created_at", "revises"]);
  const projections: Record<string, string> = {
    "activity_plan:generation->input->activityPlan": "generation->'input'->'activityPlan' as activity_plan",
    "page_count:generation->pageCount": "generation->'pageCount' as page_count",
    "page_preview_urls:generation->pagePreviewUrls": "generation->'pagePreviewUrls' as page_preview_urls",
    "family_sources:generation->familySources": "generation->'familySources' as family_sources",
    "review_pass:generation->review->>pass": "generation->'review'->>'pass' as review_pass",
  };
  return createClient("http://material-search-test.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "http://material-search-test.invalid");
      assert.equal(url.pathname, "/rest/v1/materials");
      assert.equal(options?.method ?? "GET", "GET");
      assert.ok(url.searchParams.has("family_id"));
      assert.equal(url.searchParams.get("order"), "created_at.desc");
      const limit = Number(url.searchParams.get("limit"));
      assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 3000);
      const selected = url.searchParams.get("select")!.split(",").map((field) => {
        if (projections[field]) return projections[field];
        assert.ok(columns.has(field), `unexpected projection ${field}`);
        return `"${field}"`;
      });
      const values: string[] = [];
      const where: string[] = [];
      for (const [field, expression] of url.searchParams) {
        if (["select", "order", "limit"].includes(field)) continue;
        if (field === "deleted_at") {
          assert.equal(expression, "is.null"); where.push("deleted_at is null"); continue;
        }
        assert.ok(["family_id", "child_id", "kind", "status", "title", "subject", "theme"].includes(field));
        const dot = expression.indexOf(".");
        const op = expression.slice(0, dot), value = expression.slice(dot + 1);
        assert.ok(["eq", "imatch", "ilike"].includes(op));
        if (op === "imatch") assert.equal(field, "title");
        values.push(value);
        where.push(`"${field}" ${{ eq: "=", imatch: "~*", ilike: "ilike" }[op]} $${values.length}`);
      }
      const query = `select ${selected.join(",")} from public.materials where ${where.join(" and ")} order by created_at desc limit ${limit}`;
      const result = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
        await tx`set local role authenticated`;
        await tx`set local statement_timeout='5s'`;
        const [role] = await tx`select current_user as name`;
        assert.equal(role.name, "authenticated");
        const [data] = await tx.unsafe<{ rows: unknown[] }[]>(`select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) as rows from (${query}) r`, values);
        return data.rows;
      });
      return Response.json(result);
    } },
  });
}

export async function checkMaterialTitleSearch(input: {
  sql: postgres.Sql;
  familyId: string;
  userId: string;
  foreignFamilyId: string;
}): Promise<string[]> {
  const { sql, familyId, userId, foreignFamilyId } = input;
  const database = process.env.HOMA_EVAL_DATABASE_URL;
  assert.ok(database && ["127.0.0.1", "localhost"].includes(new URL(database).hostname), "disposable database only");
  const checks: string[] = [];
  const client = callerOnPostgres(sql, userId);
  const [packet] = await sql`select child_id from public.materials where family_id=${familyId} and id=${EVAL_FIXTURE_PACKET_ID}`;
  const seed = async (title: string, options: { family?: string; status?: string; deleted?: boolean } = {}) => {
    const id = randomUUID();
    await sql`insert into public.materials(id,family_id,child_id,title,pdf_url,preview_url,html,kind,source,status,subject,theme,generation,deleted_at,created_at)
      values(${id},${options.family ?? familyId},null,${title},'fixture:pdf','fixture:preview','<p>Synthetic</p>','worksheet','html',${options.status ?? "final"},'metadata-only-subject','metadata-only-theme',
      '{"pageCount":1,"pageRoles":["child"],"review":{"pass":true}}'::jsonb,${options.deleted ? "2026-09-06T00:00:00Z" : null},'2026-09-06T12:00:00Z')`;
    return id;
  };
  // Keep the existing workbook's old date. A title filter must precede the
  // result cap, rather than asking the model to guess from the newest six.
  for (let i = 0; i < 14; i++) await seed(`Recent unrelated worksheet ${i}`);
  await seed("Maya's Letter Sounds Workbook", { family: foreignFamilyId });
  const literalCases = [
    ["100%", "100 percent"], ["A_B", "AxB"], ["A\\B", "AB"],
    ["A*B", "AxxB"], ["A.[B](C){2}|^$?+", "AxxB"],
  ];
  const literals: Array<{ title: string; id: string }> = [];
  for (const [literal, decoy] of literalCases) {
    literals.push({ title: literal, id: await seed(`Literal ${literal} page`) });
    await seed(`Literal ${decoy} page`);
    await seed(`Literal ${literal} page`, { family: foreignFamilyId });
  }
  const draft = await seed("Only draft named lookup", { status: "draft" });
  await seed("Removed named lookup", { deleted: true });
  await seed("Title result limit one"); await seed("Title result limit two"); await seed("Title result limit three");
  for (const mode of ["caller", "pinned"] as const) {
    const find = (filters: Omit<MaterialFilters, "limit"> & { limit?: number }, family = familyId) => mode === "caller"
      ? findMaterialsCaller(client, family, { limit: 6, ...filters })
      : findMaterialsPinned(family, { limit: 6, ...filters });
    assert.deepEqual((await find({ title: "letter sounds workbook", childId: packet.child_id })).map((m) => m.id), [EVAL_FIXTURE_PACKET_ID]);
    checks.push(`${mode}: actual old named workbook found by title and child despite newer rows`);
    assert.deepEqual(await find({ title: "letter sounds workbook", kind: "coloring" }), []);
    assert.deepEqual(await find({ title: "metadata-only-theme" }), []);
    checks.push(`${mode}: title is independent of metadata and composes with filters`);
    for (const literal of literals) {
      assert.deepEqual((await find({ title: literal.title })).map((m) => m.id), [literal.id]);
      checks.push(`${mode}: literal title punctuation ${JSON.stringify(literal.title)}`);
    }
    assert.deepEqual(await find({ title: "Only draft named lookup" }), []);
    assert.deepEqual((await find({ title: "Only draft named lookup", status: "any" })).map((m) => m.id), [draft]);
    assert.deepEqual(await find({ title: "Removed named lookup", status: "any" }), []);
    checks.push(`${mode}: default kept status, explicit draft lookup and deletion unchanged`);
    assert.equal((await find({ title: "Title result limit", limit: 2 })).length, 2);
    checks.push(`${mode}: result limit preserved`);
    if (mode === "caller") {
      assert.deepEqual(await find({ title: "letter sounds workbook" }, foreignFamilyId), []);
      checks.push("caller: forged family predicate still fails real RLS");
    }
  }
  // Exercise the actual legacy query, not just its source string. The whole
  // cluster is disposable and no other test runs during this temporary rename.
  const originalFlag = process.env.HOMA_SUBJECT_LESSONS_ENABLED;
  process.env.HOMA_SUBJECT_LESSONS_ENABLED = "false";
  await sql`alter table public.materials rename column subject_lesson_id to fixture_subject_lesson_id`;
  try {
    assert.deepEqual((await findMaterialsPinned(familyId, { title: "letter sounds workbook", limit: 6 })).map((m) => m.id), [EVAL_FIXTURE_PACKET_ID]);
    assert.deepEqual((await findMaterialsPinned(familyId, { title: "A*B", limit: 6 })).map((m) => m.id), [literals[3].id]);
    checks.push("pinned legacy: old title and literal wildcard lookup retain exact family scope");
  } finally {
    await sql`alter table public.materials rename column fixture_subject_lesson_id to subject_lesson_id`;
    if (originalFlag === undefined) delete process.env.HOMA_SUBJECT_LESSONS_ENABLED;
    else process.env.HOMA_SUBJECT_LESSONS_ENABLED = originalFlag;
  }
  return checks;
}
