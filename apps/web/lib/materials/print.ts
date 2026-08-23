import type { SupabaseClient } from "@supabase/supabase-js";

import {
  finalizeMaterialCaller,
  finalizeMaterialPinned,
  getMaterialCaller,
  getMaterialPinned,
  type MaterialSummary,
} from "./library";
import {
  resolveActiveMaterialCaller,
  resolveActiveMaterialPinned,
  type MaterialPageRole,
  type ResolvedActiveMaterial,
} from "../voice/active-material";

export interface MaterialPrintRequest {
  materialId: string;
  title: string;
  authorizedPdfPath: string;
  pageIndexes: number[];
  pageCount: number;
  copies: number;
  answerKeyExcluded: boolean;
}

export interface PreparedMaterialPrint {
  ready: true;
  finalizedNow: boolean;
  versionsSuperseded: number;
  material: MaterialSummary;
  activeMaterial: ResolvedActiveMaterial;
  printRequest: MaterialPrintRequest;
}

export interface RefusedMaterialPrint {
  ready: false;
  note: string;
}

export type PrepareMaterialPrintResult = PreparedMaterialPrint | RefusedMaterialPrint;

export function selectedPrintPages(input: {
  pageCount: number;
  pageRoles: readonly MaterialPageRole[] | null;
  includeAnswerKey: boolean;
}): number[] | null {
  const all = Array.from({ length: input.pageCount }, (_value, index) => index);
  if (input.includeAnswerKey) return all;
  // One page has nothing to exclude it from: unlabeled single pages (the
  // common case for a plain worksheet or coloring page) are not the
  // unlabeled-legacy-packet case below, and must not fail closed.
  if (input.pageCount <= 1) return all;
  if (!input.pageRoles) return null;
  const selected = all.filter((index) => input.pageRoles?.[index] !== "answer_key");
  return selected.length > 0 && selected.length < all.length ? selected : null;
}

interface PrintAccess {
  active(): Promise<ResolvedActiveMaterial | null>;
  material(): Promise<MaterialSummary | null>;
  finalize(): Promise<{
    finalized: boolean;
    transitioned: boolean;
    versionsSuperseded: number;
    note: string;
  }>;
}

async function prepareWithAccess(input: {
  access: PrintAccess;
  materialId: string;
  copies: number;
  includeAnswerKey: boolean;
}): Promise<PrepareMaterialPrintResult> {
  const before = await input.access.active();
  if (!before) {
    return {
      ready: false,
      note: "That is not the current visible version anymore. Show the material again and I will use the right one.",
    };
  }

  let finalizedNow = false;
  let versionsSuperseded = 0;
  if (before.status === "draft") {
    const finalization = await input.access.finalize();
    if (!finalization.finalized) return { ready: false, note: finalization.note };
    finalizedNow = finalization.transitioned;
    versionsSuperseded = finalization.versionsSuperseded;
  }

  const after = await input.access.active();
  const material = await input.access.material();
  if (!after || after.status !== "final" || !material || material.status !== "final") {
    return {
      ready: false,
      note: "I could not verify the final version, so nothing was sent to the printer.",
    };
  }
  const pageIndexes = selectedPrintPages({
    pageCount: after.pageCount,
    pageRoles: after.pageRoles,
    includeAnswerKey: input.includeAnswerKey,
  });
  if (!pageIndexes) {
    return {
      ready: false,
      note: input.includeAnswerKey
        ? "I could not prepare any printable pages. Nothing was sent to the printer."
        : "I cannot verify which page is the answer key in this older file. Open the system print sheet and choose the pages, or ask me to rebuild it with labelled pages.",
    };
  }

  return {
    ready: true,
    finalizedNow,
    versionsSuperseded,
    material,
    activeMaterial: after,
    printRequest: {
      materialId: after.id,
      title: after.title,
      authorizedPdfPath: `/api/materials/${after.id}/pdf`,
      pageIndexes,
      pageCount: after.pageCount,
      copies: input.copies,
      answerKeyExcluded: !input.includeAnswerKey,
    },
  };
}

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
      finalize: () => finalizeMaterialCaller(input.db, input.familyId, input.materialId),
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
      finalize: () => finalizeMaterialPinned(input.familyId, input.materialId),
    },
  });
}
