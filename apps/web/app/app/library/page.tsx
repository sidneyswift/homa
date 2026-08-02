import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageColumn } from "../../../components/dashboard/page-column";
import { getAppData } from "../../../lib/app-data";
import {
  type FamilyAssetUploadRow,
  toFamilyAssetUploadView,
} from "../../../lib/library/family-asset-upload-store";
import type { FamilyAssetView } from "../../../lib/library/family-assets";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "Library",
  robots: { index: false },
};

interface FamilyAssetRow {
  id: string;
  title: string;
  original_name: string;
  url: string;
  download_url: string;
  media_type: string;
  byte_size: number;
  file_kind: FamilyAssetView["fileKind"];
  resource_kind: FamilyAssetView["resourceKind"];
  status: FamilyAssetView["status"];
  processing_note: string | null;
  created_at: string;
}

export default async function LibraryPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const [assetResult, uploadResult] = await Promise.all([
    supabase
      .from("family_assets")
      .select(
        "id, title, original_name, url, download_url, media_type, byte_size, file_kind, resource_kind, status, processing_note, created_at",
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
  ]);
  if (assetResult.error) {
    throw new Error(`family Library read failed: ${assetResult.error.message}`);
  }
  if (uploadResult.error) {
    throw new Error(`family Library upload read failed: ${uploadResult.error.message}`);
  }

  const assets: FamilyAssetView[] = (
    (assetResult.data ?? []) as FamilyAssetRow[]
  ).map((row) => ({
      id: row.id,
      title: row.title,
      originalName: row.original_name,
      url: row.url,
      downloadUrl: row.download_url,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      fileKind: row.file_kind,
      resourceKind: row.resource_kind,
      status: row.status,
      processingNote: row.processing_note,
      createdAt: row.created_at,
    }));
  const uploads = ((uploadResult.data ?? []) as FamilyAssetUploadRow[]).map(
    toFamilyAssetUploadView,
  );

  return (
    <PageColumn>
      <LibraryView
        initialAssets={assets}
        initialUploads={uploads}
      />
    </PageColumn>
  );
}
