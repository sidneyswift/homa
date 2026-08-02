import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { HeadBlobResult } from "@vercel/blob";
import postgres from "postgres";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_PLAN_CHILD_ID,
  EVAL_FIXTURE_PLAN_SUBJECT,
} from "../apps/web/lib/family-context-eval-fixture";
import { resolveMaterialFamilySources } from "../apps/web/lib/library/family-asset-provenance";
import {
  findFamilyAssets,
  getFamilyAssetSource,
} from "../apps/web/lib/library/family-asset-retrieval";
import { finalizeFamilyAssetUpload } from "../apps/web/lib/library/family-asset-upload-store";
import { editPlanActivities, getPlanBoard } from "../apps/web/lib/map/store";
import { toBinderMaterials } from "../apps/web/lib/materials/binder";
import { getMaterialPinned } from "../apps/web/lib/materials/library";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const uploadId = randomUUID();
const materialId = randomUUID();
const originalName = "Harbor tide pool counting guide.pdf";
const pathname =
  `families/${EVAL_FIXTURE_FAMILY_ID}/library/${uploadId}/${originalName}`;
const blobUrl =
  `https://eval.public.blob.vercel-storage.com/${pathname}`;
const byteSize = 3210;

try {
  const [parent] = await sql<{ user_id: string }[]>`
    select user_id
    from public.family_members
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and role = 'parent'
    order by created_at
    limit 1
  `;
  assert.ok(parent?.user_id, "the eval family includes a parent member");

  await sql`
    insert into public.family_asset_uploads (
      id, family_id, initiated_by_user_id, client_request_id,
      original_name, pathname, media_type, byte_size,
      last_modified, fingerprint_sha256, status
    ) values (
      ${uploadId}, ${EVAL_FIXTURE_FAMILY_ID}, ${parent.user_id}, ${randomUUID()},
      ${originalName}, ${pathname}, 'application/pdf', ${byteSize},
      1, ${"c".repeat(64)}, 'completing'
    )
  `;

  const fakeHead = {
    url: blobUrl,
    downloadUrl: `${blobUrl}?download=1`,
    pathname,
    size: byteSize,
    uploadedAt: new Date("2026-08-02T00:00:00.000Z"),
    contentType: "application/pdf",
    contentDisposition: `attachment; filename="${originalName}"`,
    cacheControl: "public, max-age=31536000",
  } as HeadBlobResult;
  const blobDependencies = {
    head: async () => fakeHead,
    delete: async () => undefined,
  };
  const finalized = await finalizeFamilyAssetUpload(
    {
      reservationId: uploadId,
      blobUrl,
      expectedFamilyId: EVAL_FIXTURE_FAMILY_ID,
    },
    blobDependencies,
  );
  assert.equal(finalized.ok, true);
  assert.ok(finalized.ok);
  assert.equal(finalized.asset.sourceUploadId, uploadId);
  const assetId = finalized.asset.id;

  const repeated = await finalizeFamilyAssetUpload(
    {
      reservationId: uploadId,
      blobUrl,
      expectedFamilyId: EVAL_FIXTURE_FAMILY_ID,
    },
    blobDependencies,
  );
  assert.equal(repeated.ok, true);
  assert.ok(repeated.ok);
  assert.equal(repeated.asset.id, assetId);

  await sql`
    insert into public.family_asset_tags (
      family_id, asset_id, kind, value, catalog_id,
      quote, source_locator, source
    ) values (
      ${EVAL_FIXTURE_FAMILY_ID}, ${assetId}, 'subject', 'Math', 'math',
      'Count shells into small groups beside the tide pool.', 'page 4', 'parent'
    )
  `;

  const found = await findFamilyAssets(
    {
      familyId: EVAL_FIXTURE_FAMILY_ID,
      query: "harbor tide pool counting",
      limit: 3,
    },
    { embed: async () => null },
  );
  assert.equal(found[0]?.id, assetId);
  const source = await getFamilyAssetSource(
    EVAL_FIXTURE_FAMILY_ID,
    assetId,
  );
  assert.ok(source);
  assert.match(source.libraryUrl, new RegExp(`/app/library\\?asset=${assetId}$`, "u"));
  assert.ok(source.evidence.some((item) => item.sourceLocator === "page 4"));

  const materialSources = await resolveMaterialFamilySources({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    requestedAssetIds: [assetId],
  });
  assert.equal(materialSources.ok, true);
  assert.ok(materialSources.ok);
  await sql`
    insert into public.materials (
      id, family_id, child_id, title, kind, status, skill, subject,
      pdf_url, preview_url, html, generation
    ) values (
      ${materialId}, ${EVAL_FIXTURE_FAMILY_ID}, ${EVAL_FIXTURE_PLAN_CHILD_ID},
      'Tide pool counting page', 'worksheet', 'final', 'counting', 'Math',
      'https://eval.invalid/tide-pool.pdf',
      'https://eval.invalid/tide-pool.jpg',
      '<p>Count the shells.</p>',
      ${sql.json({
        pageCount: 1,
        familySources: materialSources.sources,
      })}
    )
  `;
  const material = await getMaterialPinned(
    EVAL_FIXTURE_FAMILY_ID,
    materialId,
    { finalOnly: true },
  );
  assert.ok(material);
  assert.equal(material.sources[0]?.id, assetId);
  const [binderMaterial] = toBinderMaterials([material], []);
  assert.match(
    binderMaterial.sources[0]?.libraryUrl ?? "",
    new RegExp(`/app/library\\?asset=${assetId}$`, "u"),
  );

  const activityText =
    "Count twelve seeds into three small groups, using the tide pool guide as the model.";
  const edited = await editPlanActivities(
    EVAL_FIXTURE_FAMILY_ID,
    EVAL_FIXTURE_PLAN_CHILD_ID,
    EVAL_FIXTURE_PLAN_SUBJECT,
    [
      {
        action: "add",
        week: 2,
        text: activityText,
        sourceFamilyAssetIds: [assetId],
      },
    ],
  );
  assert.equal(edited.status, "applied");
  assert.ok(edited.status === "applied");
  assert.equal(edited.sourceLinks[0]?.assetId, assetId);

  const board = await getPlanBoard(
    EVAL_FIXTURE_FAMILY_ID,
    EVAL_FIXTURE_PLAN_CHILD_ID,
  );
  const plan = board?.plans.find(
    (candidate) => candidate.subjectId === EVAL_FIXTURE_PLAN_SUBJECT,
  );
  const week = plan?.weeks.find((candidate) => candidate.week === 2);
  const activityIndex = week?.activities.indexOf(activityText) ?? -1;
  assert.ok(activityIndex >= 0);
  assert.equal(plan?.activitySources[`2.${activityIndex}`]?.[0]?.id, assetId);

  console.log("PASS  family-library-output upload-finalization-and-idempotency");
  console.log("PASS  family-library-output exact-retrieval-and-deep-link");
  console.log("PASS  family-library-output Binder-source-readback");
  console.log("PASS  family-library-output planner-source-readback");
} finally {
  await sql.end({ timeout: 5 });
}
