import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_LIBRARY_ASSET_ID,
} from "../apps/web/lib/family-context-eval-fixture";
import {
  findFamilyAssets,
  getFamilyAssetSource,
} from "../apps/web/lib/library/family-asset-retrieval";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const foreignFamilyId = randomUUID();
const foreignAssetId = randomUUID();
const decoyAssetId = randomUUID();
const deletedAssetId = randomUUID();

function vector(first: number, second: number): string {
  return `[${[first, second, ...Array<number>(1534).fill(0)].join(",")}]`;
}

const targetVector = vector(1, 0);
const decoyVector = vector(0, 1);

function assetUrl(familyId: string, name: string): string {
  return `https://eval.public.blob.vercel-storage.com/families/${familyId}/library/${name}.pdf`;
}

try {
  const [maya] = await sql<{ id: string }[]>`
    select id
    from public.children
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and name = 'Maya'
    limit 1
  `;
  assert.ok(maya?.id, "the eval fixture includes Maya");

  await sql`
    update public.family_assets
    set embedding = ${targetVector}::extensions.vector(1536)
    where id = ${EVAL_FIXTURE_LIBRARY_ASSET_ID}
      and family_id = ${EVAL_FIXTURE_FAMILY_ID}
  `;
  await sql`
    insert into public.families (id, name, sandbox)
    values (${foreignFamilyId}, 'Foreign retrieval fixture', true)
  `;
  await sql`
    insert into public.family_assets (
      id, family_id, title, original_name, url, download_url,
      media_type, byte_size, file_kind, resource_kind, status, embedding
    )
    values
      (
        ${decoyAssetId}, ${EVAL_FIXTURE_FAMILY_ID}, 'Arithmetic drill manual',
        'arithmetic-drill.pdf', ${assetUrl(EVAL_FIXTURE_FAMILY_ID, "arithmetic-drill")},
        ${assetUrl(EVAL_FIXTURE_FAMILY_ID, "arithmetic-drill")},
        'application/pdf', 1200, 'document', 'book', 'ready',
        ${decoyVector}::extensions.vector(1536)
      ),
      (
        ${deletedAssetId}, ${EVAL_FIXTURE_FAMILY_ID}, 'Deleted botany notes',
        'deleted-botany.pdf', ${assetUrl(EVAL_FIXTURE_FAMILY_ID, "deleted-botany")},
        ${assetUrl(EVAL_FIXTURE_FAMILY_ID, "deleted-botany")},
        'application/pdf', 1200, 'document', 'reference', 'ready',
        ${targetVector}::extensions.vector(1536)
      ),
      (
        ${foreignAssetId}, ${foreignFamilyId},
        'Blossom and Root Early Years Science, Volume 1',
        'foreign-blossom-root.pdf', ${assetUrl(foreignFamilyId, "foreign-blossom-root")},
        ${assetUrl(foreignFamilyId, "foreign-blossom-root")},
        'application/pdf', 1200, 'document', 'curriculum', 'ready',
        ${targetVector}::extensions.vector(1536)
      )
  `;
  await sql`
    update public.family_assets
    set deleted_at = now()
    where id = ${deletedAssetId}
      and family_id = ${EVAL_FIXTURE_FAMILY_ID}
  `;

  const semantic = await findFamilyAssets(
    {
      familyId: EVAL_FIXTURE_FAMILY_ID,
      query: "woodland botany fieldwork",
      limit: 3,
    },
    { embed: async () => targetVector },
  );
  assert.equal(semantic[0]?.id, EVAL_FIXTURE_LIBRARY_ASSET_ID);
  assert.equal(semantic[0]?.matchReason, "meaning");
  assert.deepEqual(
    semantic.map((asset) => asset.id),
    [EVAL_FIXTURE_LIBRARY_ASSET_ID],
  );
  assert.ok(semantic.every((asset) => asset.id !== foreignAssetId));
  assert.ok(semantic.every((asset) => asset.id !== deletedAssetId));

  const structured = await findFamilyAssets({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    resourceKinds: ["curriculum"],
    childId: maya.id,
    subjectIds: ["science"],
  });
  assert.deepEqual(
    structured.map((asset) => asset.id),
    [EVAL_FIXTURE_LIBRARY_ASSET_ID],
  );
  assert.equal(structured[0]?.matchReason, "structured");

  const ownSource = await getFamilyAssetSource(
    EVAL_FIXTURE_FAMILY_ID,
    EVAL_FIXTURE_LIBRARY_ASSET_ID,
  );
  assert.ok(ownSource);
  assert.match(
    ownSource.citationUrl,
    new RegExp(`/api/library/assets/${EVAL_FIXTURE_LIBRARY_ASSET_ID}/download$`, "u"),
  );
  assert.ok(
    ownSource.evidence.some(
      (item) => item.quote.includes("Seeds and plants") && item.sourceLocator === "Week 4",
    ),
  );

  const foreignSource = await getFamilyAssetSource(
    EVAL_FIXTURE_FAMILY_ID,
    foreignAssetId,
  );
  assert.equal(foreignSource, null);

  console.log("PASS  family-library-retrieval semantic-and-structured-ranking");
  console.log("PASS  family-library-retrieval citations-and-evidence");
  console.log("PASS  family-library-retrieval cross-family-and-deleted-denial");
} finally {
  await sql.end({ timeout: 5 });
}
