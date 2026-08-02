import type { SupabaseClient } from "@supabase/supabase-js";

import {
  prepareMaterialPrintCaller,
  prepareMaterialPrintPinned,
  type PrepareMaterialPrintResult,
  type PreparedMaterialPrint,
} from "./print";

export interface PreparedMaterialShareRequest {
  materialId: string;
  title: string;
  authorizedPdfPath: string;
  suggestedMessage: string;
}

export type PreparedMaterialShare =
  | {
      ready: true;
      request: PreparedMaterialShareRequest;
      material: PreparedMaterialPrint["material"];
      finalizedNow: boolean;
      versionsSuperseded: number;
    }
  | { ready: false; note: string };

function toShareResult(result: PrepareMaterialPrintResult): PreparedMaterialShare {
  if (!result.ready) return result;
  return {
    ready: true,
    request: {
      materialId: result.material.id,
      title: result.material.title,
      authorizedPdfPath: `/api/materials/${result.material.id}/pdf`,
      suggestedMessage: `I thought you'd want a copy of ${result.material.title}.`,
    },
    material: result.material,
    finalizedNow: result.finalizedNow,
    versionsSuperseded: result.versionsSuperseded,
  };
}

export async function prepareMaterialShareCaller(input: {
  db: SupabaseClient;
  familyId: string;
  materialId: string;
}): Promise<PreparedMaterialShare> {
  return toShareResult(await prepareMaterialPrintCaller({
    ...input,
    copies: 1,
    includeAnswerKey: true,
  }));
}

export async function prepareMaterialSharePinned(input: {
  familyId: string;
  materialId: string;
}): Promise<PreparedMaterialShare> {
  return toShareResult(await prepareMaterialPrintPinned({
    ...input,
    copies: 1,
    includeAnswerKey: true,
  }));
}
