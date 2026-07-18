export interface SubjectLessonWorksheetMaterialReceipt {
  id: string;
  title: string;
  kind: "worksheet";
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  status: "draft" | "final";
}

export type SubjectLessonWorksheetEffectClaim =
  | { status: "claimed" }
  | {
      status: "completed";
      material: SubjectLessonWorksheetMaterialReceipt;
    }
  | { status: "in_flight" }
  | { status: "invalid" };

export function subjectLessonWorksheetCreateKey(
  revisesId: string | null | undefined
): string {
  return revisesId ?? "initial";
}

export function resolveSubjectLessonWorksheetEffect(
  claim: SubjectLessonWorksheetEffectClaim,
):
  | {
      status: "create";
    }
  | {
      status: "completed";
      material: SubjectLessonWorksheetMaterialReceipt;
    }
  | { status: "refused" } {
  switch (claim.status) {
    case "claimed":
      return { status: "create" };
    case "completed":
      return claim;
    case "in_flight":
    case "invalid":
      return { status: "refused" };
    default: {
      const exhaustive: never = claim;
      throw new Error(
        `Unhandled subject lesson worksheet claim: ${String(exhaustive)}`
      );
    }
  }
}
