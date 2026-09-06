import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { EVAL_FIXTURE_FAMILY_ID } from "../apps/web/lib/family-context-eval-fixture";
import { applyEvalIsolation } from "../apps/web/lib/eval-isolation";
import { mapDb } from "../apps/web/lib/map/db";
import { pdfPageCache } from "../apps/web/lib/library/pdf-page-cache";
import { FAMILY_PDF_EXTRACTION_VERSION } from "../apps/web/lib/library/family-asset-read-contract";
import { processFamilyAssetWithDependencies, PRODUCTION_PROCESSING_DEPENDENCIES, queueFamilyAssetProcessingRetry,
  type FamilyAssetTextExtraction } from "../apps/web/lib/library/family-asset-processing";
import { FAMILY_ASSET_PROCESSING_QUEUED_NOTE } from "../apps/web/lib/library/family-assets";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
applyEvalIsolation(process.env);
if (!databaseUrl || process.env.HOMA_EVAL_ISOLATION !== "1") throw new Error("Run in the disposable eval sandbox.");
const sql = postgres(databaseUrl, { prepare: false, max: 3 });
const familyId = EVAL_FIXTURE_FAMILY_ID;
const id = randomUUID();
const source = { id, familyId, url: `https://eval.public.blob.vercel-storage.com/families/${familyId}/library/${id}.pdf`, sha256: "a".repeat(64) };
const page = { ordinal: 1, locator: "Page 1", text: "Lesson 7: Count six shells.", state: "readable" as const, method: "vision" as const, model: "synthetic", gaps: [] };

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
try {
  await sql`
    insert into public.family_assets (id,family_id,title,original_name,url,download_url,media_type,byte_size,file_kind,resource_kind,status)
    values (${id},${familyId},'Synthetic','synthetic.pdf',${source.url},${source.url},'application/pdf',49496583,'document','curriculum','ready')
  `;
  assert.equal(await pdfPageCache.bind(source), true);
  const leases = await Promise.all(Array.from({ length: 6 }, () => pdfPageCache.claim(source, 1)));
  const winning = leases.filter((lease): lease is string => lease !== null);
  assert.equal(winning.length, 1, "concurrent readers claim exactly one paid page read");
  assert.equal(await pdfPageCache.complete(source, page, winning[0]), true);
  assert.equal(await pdfPageCache.complete(source, { ...page, text: "late changed wording" }, winning[0]), false);
  assert.deepEqual(await pdfPageCache.get(source, 1), page);
  assert.equal(await pdfPageCache.claim(source, 1), null);
  console.log("PASS concurrent canonical page claim and immutable completion");

  const foreign = { ...source, familyId: randomUUID() };
  assert.equal(await pdfPageCache.bind(foreign), false);
  assert.equal(await pdfPageCache.get(foreign, 1), null);
  assert.equal(await pdfPageCache.claim(foreign, 1), null);
  const [member] = await sql<{ user_id: string }[]>`select user_id from public.family_members where family_id = ${familyId} limit 1`;
  assert.ok(member);
  async function countAs(userId: string) {
    return await sql.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`set local role authenticated`;
      const [row] = await tx<{ count: string }[]>`select count(*)::text as count from public.family_pdf_page_reads where asset_id = ${id}`;
      return Number(row.count);
    });
  }
  assert.equal(await countAs(member.user_id), 1);
  assert.equal(await countAs(randomUUID()), 0);
  await assert.rejects(sql.begin(async tx => {
    await tx`select set_config('request.jwt.claim.sub', ${member.user_id}, true)`;
    await tx`set local role authenticated`;
    await tx`update public.family_pdf_page_reads set text_content = 'forged quote' where asset_id = ${id}`;
  }), /permission denied/);
  console.log("PASS caller RLS and forbidden direct quote edits");

  const oldLease = await pdfPageCache.claim(source, 2); assert.ok(oldLease);
  await sql`update public.family_pdf_page_reads set lease_until = now() - interval '1 second' where asset_id = ${id} and family_id = ${familyId} and page_ordinal = 2`;
  const newLease = await pdfPageCache.claim(source, 2); assert.ok(newLease);
  assert.notEqual(oldLease, newLease);
  assert.equal(await pdfPageCache.complete(source, { ...page, ordinal: 2 }, oldLease), false);
  assert.equal(await pdfPageCache.complete(source, { ...page, ordinal: 2 }, newLease), true);
  const changed = { ...source, sha256: "b".repeat(64) };
  assert.equal(await pdfPageCache.bind(changed), true);
  assert.equal(await pdfPageCache.get(source, 1), null);
  assert.equal(await countAs(member.user_id), 0);
  assert.equal(await pdfPageCache.get(changed, 1), null);
  const changedLease = await pdfPageCache.claim(changed, 1); assert.ok(changedLease);
  await sql`update public.family_assets set deleted_at = now() where id = ${id} and family_id = ${familyId}`;
  assert.equal(await pdfPageCache.complete(changed, page, changedLease), false);
  assert.equal(await pdfPageCache.bind(changed), false);
  assert.equal(await countAs(member.user_id), 0);
  console.log("PASS lease recovery, source fingerprint invalidation and parent deletion");

  await sql`update public.family_assets set deleted_at = null, status = 'processing', processing_note = ${FAMILY_ASSET_PROCESSING_QUEUED_NOTE} where id = ${id} and family_id = ${familyId}`;
  const oldExtract = deferred<FamilyAssetTextExtraction>(); const oldClaimed = deferred<void>();
  const newExtract = deferred<FamilyAssetTextExtraction>(); const newClaimed = deferred<void>();
  const proposal = { title: { value: "Synthetic", quote: "Synthetic", sourceLocator: "Page 1" }, resourceKind: { value: "curriculum", quote: "Curriculum", sourceLocator: "Page 1" }, language: "en", tags: [] };
  const deps = { ...PRODUCTION_PROCESSING_DEPENDENCIES, propose: async () => proposal, embed: async () => null };
  let staleAsset: Parameters<typeof PRODUCTION_PROCESSING_DEPENDENCIES.fail>[0]["asset"] | undefined;
  const first = processFamilyAssetWithDependencies({ familyId, assetId: id }, {
    ...deps, extract: async (asset) => { staleAsset = asset; oldClaimed.resolve(); return oldExtract.promise; },
  });
  await oldClaimed.promise;
  await sql`update public.family_assets set updated_at = now() - interval '10 minutes' where id = ${id} and family_id = ${familyId}`;
  assert.deepEqual(await queueFamilyAssetProcessingRetry({ familyId, assetId: id }), { ok: true });
  const second = processFamilyAssetWithDependencies({ familyId, assetId: id }, {
    ...deps, extract: async () => { newClaimed.resolve(); return newExtract.promise; },
  });
  await newClaimed.promise;
  assert.ok(staleAsset);
  await PRODUCTION_PROCESSING_DEPENDENCIES.fail({ asset: staleAsset, outcome: {
    status: "failed", errorCode: "processing_failed", processingNote: "Old failed attempt", preserveOriginal: true,
  } });
  const [afterStaleFailure] = await sql<{ status: string }[]>`select status from public.family_assets where id = ${id} and family_id = ${familyId}`;
  assert.equal(afterStaleFailure.status, "processing", "old failure cannot fail the new attempt");
  await sql`update public.family_assets set title = 'Parent keeps this title', updated_at = now() where id = ${id} and family_id = ${familyId}`;
  oldExtract.resolve({ ok: true, text: "Synthetic Curriculum" });
  assert.deepEqual(await first, { ok: false, reason: "not-claimed" });
  const [during] = await sql<{ status: string }[]>`select status from public.family_assets where id = ${id} and family_id = ${familyId}`;
  assert.equal(during.status, "processing", "old completion cannot complete the new attempt");
  newExtract.resolve({ ok: true, text: "Synthetic Curriculum", coverageNote: "Sampled page 1 of 115. Remaining pages were not read." });
  assert.deepEqual(await second, { ok: true, assetId: id });
  const [after] = await sql<{ status: string; title: string; processing_version: string; processing_note: string }[]>`select status,title,processing_version,processing_note from public.family_assets where id = ${id} and family_id = ${familyId}`;
  assert.equal(after.status, "ready"); assert.equal(after.title, "Parent keeps this title");
  assert.equal(after.processing_version, FAMILY_PDF_EXTRACTION_VERSION); assert.match(after.processing_note, /Remaining pages were not read/);
  console.log("PASS stale processing completion cannot overwrite a newer claim or parent metadata");
} finally {
  await sql`delete from public.family_assets where id = ${id} and family_id = ${familyId}`;
  await sql.end();
  await mapDb().end();
}
