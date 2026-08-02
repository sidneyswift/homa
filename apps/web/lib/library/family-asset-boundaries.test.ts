import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("Family Library writes and downloads re-scope client ids to the authenticated family", () => {
  const assetRoute = source("../../app/api/library/assets/route.ts");
  const assetStore = source("./family-asset-store.ts");
  const downloadRoute = source("../../app/api/library/assets/[id]/download/route.ts");
  const processRoute = source("../../app/api/library/assets/[id]/process/route.ts");
  const processor = source("./family-asset-processing.ts");
  const promotion = source("./family-asset-promotion.ts");
  const retrieval = source("./family-asset-retrieval.ts");

  assert.match(assetRoute, /familyId:\s*auth\.familyId/u);
  assert.match(assetRoute, /deleteFamilyAsset/u);
  assert.match(assetStore, /where id = \$\{input\.patch\.id\}[\s\S]*?and family_id = \$\{input\.familyId\}[\s\S]*?for update/u);
  assert.match(assetStore, /from public\.children[\s\S]*?where family_id = \$\{input\.familyId\}/u);
  assert.match(assetStore, /delete from public\.family_asset_children[\s\S]*?and family_id = \$\{input\.familyId\}/u);
  assert.match(assetStore, /delete from public\.family_asset_tags[\s\S]*?and family_id = \$\{input\.familyId\}/u);
  assert.match(assetStore, /isFamilyLibraryUrl\(row\.url, input\.familyId\)/u);
  assert.match(downloadRoute, /and family_id = \$\{auth\.familyId\}/u);
  assert.match(downloadRoute, /and deleted_at is null/u);
  assert.match(processRoute, /familyId:\s*auth\.familyId/u);
  assert.doesNotMatch(processRoute, /request\.json/u);
  assert.match(
    processor,
    /where id = \$\{input\.assetId\}[\s\S]*?and family_id = \$\{input\.familyId\}[\s\S]*?and deleted_at is null/u,
  );
  assert.match(processor, /isFamilyLibraryUrl\(asset\.url, asset\.familyId\)/u);
  assert.match(
    promotion,
    /where attachment\.id = \$\{input\.attachmentId\}[\s\S]*?and attachment\.family_id = \$\{input\.familyId\}/u,
  );
  assert.match(
    promotion,
    /isFamilyChatAttachmentUrl\(attachment\.url, input\.familyId\)/u,
  );
  assert.match(
    retrieval,
    /where asset\.id = \$\{assetId\}[\s\S]*?and asset\.family_id = \$\{familyId\}[\s\S]*?and asset\.deleted_at is null/u,
  );
  assert.doesNotMatch(assetStore, /familyId:\s*z\./u);
});

test("Family Library agent tools never accept a model-selected family id", () => {
  for (const name of [
    "save_family_asset",
    "find_family_assets",
    "get_family_asset",
    "update_family_asset",
    "delete_family_asset",
  ]) {
    const tool = source(`../../agent/tools/${name}.ts`);
    assert.match(tool, /resolveAgentAccess/u, `${name} must authenticate its family`);
    const schema = /inputSchema:\s*([\s\S]*?),\n\s*async execute/u.exec(tool)?.[1];
    assert.ok(schema, `${name} input schema was not found`);
    assert.doesNotMatch(schema, /familyId/u, `${name} accepts a model-selected family`);
  }
});

test("chat promotion is one active Library asset with independent bytes", () => {
  const migration = source(
    "../../../../supabase/migrations/20260802044500_family_library_agent_retrieval.sql",
  );
  const promotion = source("./family-asset-promotion.ts");

  assert.match(
    migration,
    /unique index[\s\S]*?\(family_id, source_attachment_id\)[\s\S]*?deleted_at is null/u,
  );
  assert.match(promotion, /await copy\(attachment\.url, pathname/u);
  assert.match(promotion, /families\/\$\{input\.familyId\}\/library\/chat\//u);
  assert.doesNotMatch(promotion, /insert into public\.family_assets[\s\S]*?attachment\.url/u);
});

test("cookie-authenticated API routes derive auth from their explicit Request", () => {
  const apiAuth = source("../api-auth.ts");
  const supabaseServer = source("../supabase/server.ts");

  assert.match(apiAuth, /createSupabaseRequestClient\(request\)/u);
  assert.match(
    supabaseServer,
    /parseCookieHeader\([\s\S]*?request\.headers\.get\("cookie"\)/u,
  );
});

test("the records exception does not reopen uploads or neighboring paid pages", () => {
  const uploadRoute = source("../../app/api/library/upload/route.ts");
  const uploadsRoute = source("../../app/api/library/uploads/route.ts");
  const layout = source("../../app/app/layout.tsx");
  const taskPage = source("../../app/app/tasks/page.tsx");
  const recordPage = source("../../app/app/[childId]/lessons/record/page.tsx");
  const reviewPage = source("../../app/app/lessons/[lessonId]/page.tsx");

  assert.match(uploadRoute, /familyAccountCheckout\(auth\.familyId\)/u);
  assert.ok(
    (uploadsRoute.match(/familyAccountCheckout\(auth\.familyId\)/gu) ?? []).length >= 2,
    "upload reservation and mutation must both check membership",
  );
  assert.match(layout, /getAppShellData/u);
  for (const paidPage of [taskPage, recordPage, reviewPage]) {
    assert.match(paidPage, /getPaidAppShellData/u);
  }
});

test("an idempotent upload reservation emits its start event only once", () => {
  const uploadsRoute = source("../../app/api/library/uploads/route.ts");

  assert.match(uploadsRoute, /\(xmax = 0\) as inserted/u);
  assert.match(
    uploadsRoute,
    /if \(row\.inserted\) \{[\s\S]*?emitMapEvent\("library\.upload_started"/u,
  );
});
