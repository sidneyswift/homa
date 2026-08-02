import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_LIBRARY_ASSET_ID,
} from "../apps/web/lib/family-context-eval-fixture";
import {
  acknowledgeFamilyAssetTrainingRemoval,
  buildFamilyAssetTrainingDatasetArtifacts,
  commitFamilyAssetTrainingDataset,
  prepareFamilyAssetTrainingSource,
  type FamilyAssetTrainingSourceContext,
} from "../apps/web/lib/library/family-asset-training";
import { getFamilyAssetSource } from "../apps/web/lib/library/family-asset-retrieval";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) throw new Error("Run through pnpm eval:sandbox.");

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const secondAssetId = randomUUID();
const foreignFamilyId = randomUUID();
const foreignAssetId = randomUUID();

function assetUrl(familyId: string, assetId: string): string {
  return `https://eval.public.blob.vercel-storage.com/families/${familyId}/library/${assetId}.txt`;
}

async function context(assetId: string): Promise<FamilyAssetTrainingSourceContext> {
  const [row] = await sql<
    Array<{
      id: string;
      family_id: string;
      title: string;
      original_name: string;
      url: string;
      media_type: string;
      byte_size: number;
      resource_kind: "curriculum" | "worksheet";
      language: string | null;
      status: "ready";
      content_sha256: string | null;
      deleted_at: string | null;
    }>
  >`
    select id, family_id, title, original_name, url, media_type,
           byte_size::int, resource_kind, language, status,
           content_sha256, deleted_at::text
    from public.family_assets
    where id = ${assetId}
  `;
  assert.ok(row);
  const children = await sql<Array<{ name: string; birth_date: string }>>`
    select name, to_char(birth_month, 'YYYY-MM-DD') as birth_date
    from public.children
    where family_id = ${row.family_id}
  `;
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    originalName: row.original_name,
    url: row.url,
    mediaType: row.media_type,
    byteSize: row.byte_size,
    resourceKind: row.resource_kind,
    language: row.language,
    status: row.status,
    contentSha256: row.content_sha256,
    deletedAt: row.deleted_at,
    children: children.map((child) => ({
      name: child.name,
      birthDate: child.birth_date,
    })),
  };
}

async function prepared(assetId: string, text: string) {
  const source = await context(assetId);
  return await prepareFamilyAssetTrainingSource(
    { assetId },
    {
      load: async () => source,
      extract: async () => ({
        ok: true,
        segmentKind: "section",
        segments: [{ ordinal: 1, locator: "Section 1", text }],
        totalSegments: 1,
        truncated: false,
      }),
    },
  );
}

async function commitVersion(datasetVersion: string, sources: Awaited<ReturnType<typeof prepared>>[]) {
  const artifacts = buildFamilyAssetTrainingDatasetArtifacts({
    datasetVersion,
    sources,
  });
  return await commitFamilyAssetTrainingDataset({
    datasetVersion,
    sources,
    artifacts,
  });
}

try {
  await sql`
    insert into public.families (id, name, sandbox)
    values (${foreignFamilyId}, 'Training foreign-family fixture', true)
  `;
  await sql`
    insert into public.family_assets (
      id, family_id, title, original_name, url, download_url,
      media_type, byte_size, file_kind, resource_kind, status,
      content_sha256, processed_at
    ) values
      (
        ${secondAssetId}, ${EVAL_FIXTURE_FAMILY_ID}, 'Second safe source',
        'second-source.txt', ${assetUrl(EVAL_FIXTURE_FAMILY_ID, secondAssetId)},
        ${assetUrl(EVAL_FIXTURE_FAMILY_ID, secondAssetId)}, 'text/plain', 64,
        'document', 'worksheet', 'ready', ${"b".repeat(64)}, now()
      ),
      (
        ${foreignAssetId}, ${foreignFamilyId}, 'Foreign source',
        'foreign-source.txt', ${assetUrl(foreignFamilyId, foreignAssetId)},
        ${assetUrl(foreignFamilyId, foreignAssetId)}, 'text/plain', 64,
        'document', 'worksheet', 'ready', ${"c".repeat(64)}, now()
      )
  `;

  const [privileges] = await sql<
    Array<{
      anon_schema: boolean;
      auth_schema: boolean;
      anon_table: boolean;
      auth_table: boolean;
    }>
  >`
    select
      has_schema_privilege('anon', 'training', 'USAGE') as anon_schema,
      has_schema_privilege('authenticated', 'training', 'USAGE') as auth_schema,
      has_table_privilege('anon', 'training.family_asset_sources', 'SELECT') as anon_table,
      has_table_privilege('authenticated', 'training.family_asset_sources', 'SELECT') as auth_table
  `;
  assert.deepEqual(privileges, {
    anon_schema: false,
    auth_schema: false,
    anon_table: false,
    auth_table: false,
  });

  const firstSource = await prepared(
    EVAL_FIXTURE_LIBRARY_ASSET_ID,
    "Plant roots absorb water and minerals from the soil.",
  );
  const committed = await commitVersion("family-library-e2e-v1", [firstSource]);
  assert.deepEqual(committed, { status: "committed", recordCount: 1 });
  const repeated = await commitVersion("family-library-e2e-v1", [firstSource]);
  assert.deepEqual(repeated, { status: "already_committed", recordCount: 1 });

  const [ready] = await sql<
    Array<{
      source_id: string;
      export_id: string;
      action_id: number;
      status: string;
      source_decision: string;
      export_status: string;
      actions: string[];
    }>
  >`
    select source.id as source_id, export.id as export_id,
           min(action.id)::int as action_id, build.status,
           source.decision as source_decision,
           export.status as export_status,
           array_agg(action.action order by action.id) as actions
    from training.dataset_builds build
    join training.family_asset_sources source
      on source.dataset_build_id = build.id
    join training.family_asset_exports export
      on export.source_id = source.id
    join training.family_asset_actions action
      on action.source_id = source.id
    where build.dataset_version = 'family-library-e2e-v1'
    group by source.id, export.id, build.status, source.decision, export.status
  `;
  assert.equal(ready?.status, "ready");
  assert.equal(ready?.source_decision, "eligible");
  assert.equal(ready?.export_status, "included");
  assert.deepEqual(ready?.actions, ["eligibility_recorded", "export_included"]);
  assert.ok(ready);
  await assert.rejects(
    sql`
      update training.dataset_builds
      set status = 'building'
      where dataset_version = 'family-library-e2e-v1'
    `,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23514",
  );
  await assert.rejects(
    sql`
      update training.family_asset_sources
      set decision = 'excluded', exclusion_reasons = array['operator_excluded']
      where id = ${ready.source_id}
    `,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ["23514", "42501"].includes(String(error.code)),
  );
  await assert.rejects(
    sql`
      update training.family_asset_exports
      set included_at = included_at + interval '1 second'
      where id = ${ready.export_id}
    `,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42501",
  );
  await assert.rejects(
    sql`
      update training.family_asset_actions
      set reason_codes = array['operator_excluded']
      where id = ${ready.action_id}
    `,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42501",
  );

  const [build] = await sql<{ id: string }[]>`
    insert into training.dataset_builds (dataset_version, pipeline_version)
    values ('family-library-cross-family-e2e', 'family-library-jsonl-v1')
    returning id
  `;
  assert.ok(build);
  await assert.rejects(
    sql`
      insert into training.family_asset_sources (
        dataset_build_id, family_id, source_asset_id,
        extracted_content_sha256, ingestion_version, safety_policy_version,
        transform_manifest, decision, idempotency_key
      ) values (
        ${build.id}, ${foreignFamilyId}, ${EVAL_FIXTURE_LIBRARY_ASSET_ID},
        ${"d".repeat(64)}, 'family-library-source-v1',
        'family-library-privacy-v1', '{}'::jsonb, 'eligible', ${"e".repeat(64)}
      )
    `,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503",
  );

  await sql`
    update public.family_assets
    set deleted_at = now()
    where id = ${EVAL_FIXTURE_LIBRARY_ASSET_ID}
      and family_id = ${EVAL_FIXTURE_FAMILY_ID}
  `;
  const [withdrawn] = await sql<
    Array<{
      build_status: string;
      source_decision: string;
      export_status: string;
      source_deleted_actions: number;
      removal_actions: number;
    }>
  >`
    select build.status as build_status,
           source.decision as source_decision,
           export.status as export_status,
           count(*) filter (where action.action = 'source_deleted')::int
             as source_deleted_actions,
           count(*) filter (
             where action.action = 'downstream_removal_required'
           )::int as removal_actions
    from training.dataset_builds build
    join training.family_asset_sources source
      on source.dataset_build_id = build.id
    join training.family_asset_exports export
      on export.source_id = source.id
    join training.family_asset_actions action
      on action.source_id = source.id
    where build.dataset_version = 'family-library-e2e-v1'
    group by build.status, source.decision, export.status
  `;
  assert.deepEqual(withdrawn, {
    build_status: "withdrawal_required",
    source_decision: "source_deleted",
    export_status: "removal_required",
    source_deleted_actions: 1,
    removal_actions: 1,
  });
  assert.equal(
    await getFamilyAssetSource(
      EVAL_FIXTURE_FAMILY_ID,
      EVAL_FIXTURE_LIBRARY_ASSET_ID,
    ),
    null,
  );

  await assert.rejects(
    commitVersion("family-library-deleted-source-e2e", [firstSource]),
    /deleted family assets cannot enter a training export|only a live eligible family asset/u,
  );
  const removal = await acknowledgeFamilyAssetTrainingRemoval({
    datasetVersion: "family-library-e2e-v1",
    sourceAssetId: EVAL_FIXTURE_LIBRARY_ASSET_ID,
    evidence: "Rebuilt as family-library-e2e-v2 without the deleted source.",
  });
  assert.deepEqual(removal, { removed: 1, datasetRetired: true });
  const [retired] = await sql<
    Array<{ build_status: string; export_status: string; completed: number }>
  >`
    select build.status as build_status, export.status as export_status,
           count(*) filter (
             where action.action = 'downstream_removal_completed'
           )::int as completed
    from training.dataset_builds build
    join training.family_asset_sources source
      on source.dataset_build_id = build.id
    join training.family_asset_exports export
      on export.source_id = source.id
    join training.family_asset_actions action
      on action.export_id = export.id
    where build.dataset_version = 'family-library-e2e-v1'
    group by build.status, export.status
  `;
  assert.deepEqual(retired, {
    build_status: "retired",
    export_status: "removed",
    completed: 1,
  });

  const secondSource = await prepared(
    secondAssetId,
    "A second source proves hard-delete propagation.",
  );
  await commitVersion("family-library-hard-delete-e2e", [secondSource]);
  await sql`
    delete from public.family_assets
    where id = ${secondAssetId}
      and family_id = ${EVAL_FIXTURE_FAMILY_ID}
  `;
  const [hardDeleted] = await sql<
    Array<{ build_status: string; source_decision: string; export_status: string }>
  >`
    select build.status as build_status, source.decision as source_decision,
           export.status as export_status
    from training.dataset_builds build
    join training.family_asset_sources source
      on source.dataset_build_id = build.id
    join training.family_asset_exports export
      on export.source_id = source.id
    where build.dataset_version = 'family-library-hard-delete-e2e'
  `;
  assert.deepEqual(hardDeleted, {
    build_status: "withdrawal_required",
    source_decision: "source_deleted",
    export_status: "removal_required",
  });

  console.log("PASS  family-library-training schema-is-not-product-readable");
  console.log("PASS  family-library-training atomic-versioned-export-and-idempotency");
  console.log("PASS  family-library-training audit-history-is-append-only");
  console.log("PASS  family-library-training cross-family-source-rejected");
  console.log("PASS  family-library-training soft-delete-tombstone-and-removal-ledger");
  console.log("PASS  family-library-training hard-delete-propagation");
} finally {
  await sql.end({ timeout: 5 });
}
