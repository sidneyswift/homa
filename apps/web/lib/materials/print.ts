import type { SupabaseClient } from "@supabase/supabase-js";

import {
  finalizeMaterialCaller,
  finalizeMaterialPinned,
  getMaterialCaller,
  getMaterialPinned,
} from "./library";
import {
  resolveActiveMaterialCaller,
  resolveActiveMaterialPinned,
} from "../voice/active-material";

import { prepareWithAccess, type PrepareMaterialPrintResult } from "./print-preparation";
export { selectedPrintPages } from "./print-preparation";
export type { MaterialPrintRequest, PreparedMaterialPrint, RefusedMaterialPrint, PrepareMaterialPrintResult } from "./print-preparation";

export async function prepareMaterialPrintCaller(input: {
  db: SupabaseClient;
  familyId: string;
  materialId: string;
  copies: number;
  includeAnswerKey: boolean;
}): Promise<PrepareMaterialPrintResult> {
  return prepareWithAccess({
    ...input,
    access: {
      active: () => resolveActiveMaterialCaller(input.db, input.familyId, input.materialId),
      material: () => getMaterialCaller(input.db, input.familyId, input.materialId),
      finalize: () => finalizeMaterialCaller(input.db, input.familyId, input.materialId, undefined, undefined, { requireCurrentVisible: true }),
    },
  });
}

export async function prepareMaterialPrintPinned(input: {
  familyId: string;
  materialId: string;
  copies: number;
  includeAnswerKey: boolean;
}): Promise<PrepareMaterialPrintResult> {
  return prepareWithAccess({
    ...input,
    access: {
      active: () => resolveActiveMaterialPinned(input.familyId, input.materialId),
      material: () => getMaterialPinned(input.familyId, input.materialId),
      finalize: () => finalizeMaterialPinned(input.familyId, input.materialId, { requireCurrentVisible: true }),
    },
  });
}
