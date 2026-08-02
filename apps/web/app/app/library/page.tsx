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
import type {
  FamilyCurriculumUnitConfidence,
  FamilyCurriculumUnitKind,
  FamilyCurriculumUnitView,
} from "../../../lib/library/family-assets";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "Library",
  robots: { index: false },
};

const FAMILY_ASSET_LIBRARY_SELECT =
  "id, title, original_name, url, download_url, media_type, byte_size, file_kind, resource_kind, authors, publisher, language, status, processing_error_code, processing_note, source_upload_id, source_attachment_id, parent_asset_id, processed_at, created_at, updated_at";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

interface FamilyCurriculumUnitRow {
  id: string;
  parent_asset_id: string;
  ordinal: number;
  unit_label: string;
  unit_kind: FamilyCurriculumUnitKind;
  unit_source_locator: string;
  unit_confidence: FamilyCurriculumUnitConfidence;
  unit_summary: string;
  is_current_decomposition: boolean;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string | string[] }>;
}) {
  const data = await getAppShellData();
  if (!data) redirect("/onboarding");

  const requestedAsset = (await searchParams).asset;
  const requestedAssetId =
    typeof requestedAsset === "string" && UUID_PATTERN.test(requestedAsset)
      ? requestedAsset
      : null;

  const supabase = await createSupabaseServerClient();
  const [
    assetResult,
    unitResult,
    uploadResult,
    childLinkResult,
    subjectTagResult,
    gate,
  ] = await Promise.all([
    supabase
      .from("family_assets")
      .select(FAMILY_ASSET_LIBRARY_SELECT)
      .is("deleted_at", null)
      .is("parent_asset_id", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("family_assets")
      .select(
        "id, parent_asset_id, ordinal, unit_label, unit_kind, unit_source_locator, unit_confidence, unit_summary, is_current_decomposition",
      )
      .is("deleted_at", null)
      .not("parent_asset_id", "is", null)
      .eq("is_current_decomposition", true)
      .order("parent_asset_id", { ascending: true })
      .order("ordinal", { ascending: true })
      .limit(1200),
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
  if (unitResult.error) {
    throw new Error(`family Library curriculum read failed: ${unitResult.error.message}`);
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

  let assetRows = (assetResult.data ?? []) as FamilyAssetRow[];
  let unitRows = (unitResult.data ?? []) as FamilyCurriculumUnitRow[];
  let requestedUnit = requestedAssetId
    ? unitRows.find((unit) => unit.id === requestedAssetId) ?? null
    : null;

  if (
    requestedAssetId &&
    !requestedUnit &&
    !assetRows.some((asset) => asset.id === requestedAssetId)
  ) {
    const exactUnitResult = await supabase
      .from("family_assets")
      .select(
        "id, parent_asset_id, ordinal, unit_label, unit_kind, unit_source_locator, unit_confidence, unit_summary, is_current_decomposition",
      )
      .eq("id", requestedAssetId)
      .is("deleted_at", null)
      .not("parent_asset_id", "is", null)
      .maybeSingle();
    if (exactUnitResult.error) {
      throw new Error(
        `family Library exact curriculum unit read failed: ${exactUnitResult.error.message}`,
      );
    }
    requestedUnit = exactUnitResult.data as FamilyCurriculumUnitRow | null;
    if (requestedUnit) {
      unitRows = [...unitRows, requestedUnit];
      if (!assetRows.some((asset) => asset.id === requestedUnit?.parent_asset_id)) {
        const parentResult = await supabase
          .from("family_assets")
          .select(FAMILY_ASSET_LIBRARY_SELECT)
          .eq("id", requestedUnit.parent_asset_id)
          .is("deleted_at", null)
          .is("parent_asset_id", null)
          .maybeSingle();
        if (parentResult.error) {
          throw new Error(
            `family Library curriculum parent read failed: ${parentResult.error.message}`,
          );
        }
        if (parentResult.data) {
          assetRows = [...assetRows, parentResult.data as FamilyAssetRow];
        }
      }
    }
  }
  const visibleAssetIds = new Set([
    ...assetRows.map((row) => row.id),
    ...unitRows.map((row) => row.id),
  ]);
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
  const curriculumUnitsByParent: Record<string, FamilyCurriculumUnitView[]> = {};
  for (const row of unitRows) {
    if (
      !row.parent_asset_id ||
      !Number.isInteger(row.ordinal) ||
      !row.unit_label ||
      !row.unit_kind ||
      !row.unit_source_locator ||
      !row.unit_confidence ||
      !row.unit_summary
    ) {
      continue;
    }
    const units = curriculumUnitsByParent[row.parent_asset_id] ?? [];
    units.push({
      id: row.id,
      parentAssetId: row.parent_asset_id,
      isCurrent: row.is_current_decomposition,
      ordinal: row.ordinal,
      unitLabel: row.unit_label,
      unitKind: row.unit_kind,
      sourceLocator: row.unit_source_locator,
      confidence: row.unit_confidence,
      summary: row.unit_summary,
      children: childrenByAsset.get(row.id) ?? [],
      subjects: subjectsByAsset.get(row.id) ?? [],
    });
    curriculumUnitsByParent[row.parent_asset_id] = units;
  }
  const initialSelectedAssetId =
    requestedAssetId && assets.some((asset) => asset.id === requestedAssetId)
      ? requestedAssetId
      : requestedUnit && assets.some((asset) => asset.id === requestedUnit.parent_asset_id)
        ? requestedUnit.parent_asset_id
      : null;
  const initialSelectedUnitId = requestedUnit?.id ?? null;
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
        initialCurriculumUnitsByParent={curriculumUnitsByParent}
        initialUploads={uploads}
        childOptions={data.children.map((child) => ({ id: child.id, name: child.name }))}
        subjectOptions={MAP_SUBJECTS.map((subject) => ({
          id: subject.id,
          label: subject.displayName,
        }))}
        canUpload={access.canUpload}
        initialSelectedAssetId={initialSelectedAssetId}
        initialSelectedUnitId={initialSelectedUnitId}
      />
    </PageColumn>
  );
}
