import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MAP_SUBJECTS } from "@homa/core";

import { PageColumn } from "../../../components/dashboard/page-column";
import { getAppShellData } from "../../../lib/app-data";
import { familyAccountGate } from "../../../lib/billing/wall";
import {
  type FamilyAssetRow,
  type FamilyAssetUploadRow,
  toFamilyAssetView,
  toFamilyAssetUploadView,
} from "../../../lib/library/family-asset-upload-store";
import { familyLibraryAccess } from "../../../lib/library/family-asset-shelf";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "Library",
  robots: { index: false },
};

interface FamilyAssetChildLinkRow {
  asset_id: string;
  child_id: string;
}

interface FamilyAssetSubjectTagRow {
  id: string;
  asset_id: string;
  value: string;
  catalog_id: string | null;
  source: "model" | "parent" | "import" | "system";
}

export default async function LibraryPage() {
  const data = await getAppShellData();
  if (!data) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const [assetResult, uploadResult, childLinkResult, subjectTagResult, gate] = await Promise.all([
    supabase
      .from("family_assets")
      .select(
        "id, title, original_name, url, download_url, media_type, byte_size, file_kind, resource_kind, authors, publisher, language, status, processing_error_code, processing_note, source_upload_id, source_attachment_id, parent_asset_id, processed_at, created_at, updated_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("family_asset_uploads")
      .select(
        "id, family_id, initiated_by_user_id, original_name, pathname, media_type, byte_size, last_modified, fingerprint_sha256, blob_upload_id, blob_key, completed_parts, status, status_note, error_code, created_at, updated_at",
      )
      .not("status", "in", "(ready,abandoned)")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("family_asset_children")
      .select("asset_id, child_id")
      .limit(5000),
    supabase
      .from("family_asset_tags")
      .select("id, asset_id, value, catalog_id, source")
      .eq("kind", "subject")
      .limit(5000),
    familyAccountGate(data.family.id),
  ]);
  if (assetResult.error) {
    throw new Error(`family Library read failed: ${assetResult.error.message}`);
  }
  if (uploadResult.error) {
    throw new Error(`family Library upload read failed: ${uploadResult.error.message}`);
  }
  if (childLinkResult.error) {
    throw new Error(`family Library child read failed: ${childLinkResult.error.message}`);
  }
  if (subjectTagResult.error) {
    throw new Error(`family Library subject read failed: ${subjectTagResult.error.message}`);
  }

  const assetRows = (assetResult.data ?? []) as FamilyAssetRow[];
  const visibleAssetIds = new Set(assetRows.map((row) => row.id));
  const childById = new Map(data.children.map((child) => [child.id, child.name]));
  const subjectById = new Map(
    MAP_SUBJECTS.map((subject) => [subject.id, subject.displayName]),
  );
  const childrenByAsset = new Map<string, Array<{ id: string; name: string }>>();
  for (const link of (childLinkResult.data ?? []) as FamilyAssetChildLinkRow[]) {
    if (!visibleAssetIds.has(link.asset_id)) continue;
    const name = childById.get(link.child_id);
    if (!name) continue;
    const children = childrenByAsset.get(link.asset_id) ?? [];
    children.push({ id: link.child_id, name });
    childrenByAsset.set(link.asset_id, children);
  }
  const subjectsByAsset = new Map<
    string,
    Array<{ id: string; label: string; source: FamilyAssetSubjectTagRow["source"] }>
  >();
  for (const tag of (subjectTagResult.data ?? []) as FamilyAssetSubjectTagRow[]) {
    if (!visibleAssetIds.has(tag.asset_id)) continue;
    const id = tag.catalog_id && subjectById.has(tag.catalog_id)
      ? tag.catalog_id
      : `tag:${tag.id}`;
    const label = tag.catalog_id ? subjectById.get(tag.catalog_id) ?? tag.value : tag.value;
    const subjects = subjectsByAsset.get(tag.asset_id) ?? [];
    subjects.push({ id, label, source: tag.source });
    subjectsByAsset.set(tag.asset_id, subjects);
  }
  const assets = assetRows.map((row) =>
    toFamilyAssetView(row, {
      children: childrenByAsset.get(row.id) ?? [],
      subjects: subjectsByAsset.get(row.id) ?? [],
    }),
  );
  const uploads = ((uploadResult.data ?? []) as FamilyAssetUploadRow[]).map(
    toFamilyAssetUploadView,
  );
  const access = familyLibraryAccess({
    walled: gate.checkout !== null,
    hasExistingRecords: assets.length > 0 || uploads.length > 0,
  });
  if (access.redirectToTrial) {
    redirect("/onboarding/trial");
  }

  return (
    <PageColumn>
      <LibraryView
        initialAssets={assets}
        initialUploads={uploads}
        childOptions={data.children.map((child) => ({ id: child.id, name: child.name }))}
        subjectOptions={MAP_SUBJECTS.map((subject) => ({
          id: subject.id,
          label: subject.displayName,
        }))}
        canUpload={access.canUpload}
      />
    </PageColumn>
  );
}
