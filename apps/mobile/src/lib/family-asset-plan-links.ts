import { env } from "./env";
import { supabase } from "./supabase";

export interface FamilyAssetPlanLinkRecord {
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  activityText: string;
  assetId: string;
  sourceTitle: string;
  libraryUrl: string;
}

function libraryUrl(assetId: string): string {
  const origin = env.apiUrl.replace(/\/$/u, "");
  return `${origin}/app/library?asset=${encodeURIComponent(assetId)}`;
}

export async function getFamilyAssetPlanLinks(
  familyId: string,
  childIds: readonly string[],
): Promise<FamilyAssetPlanLinkRecord[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await supabase
    .from("family_asset_plan_links")
    .select(
      "child_id, subject_id, week, activity_index, activity_text, asset_id, source_title",
    )
    .eq("family_id", familyId)
    .in("child_id", [...childIds]);
  if (error) {
    throw new Error(`plan source read failed: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    childId: row.child_id as string,
    subjectId: row.subject_id as string,
    week: row.week as number,
    activityIndex: row.activity_index as number,
    activityText: row.activity_text as string,
    assetId: row.asset_id as string,
    sourceTitle: row.source_title as string,
    libraryUrl: libraryUrl(row.asset_id as string),
  }));
}
