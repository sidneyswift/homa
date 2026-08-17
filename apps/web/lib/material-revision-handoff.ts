const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const ACTIVE_MATERIAL_HEADER = "x-homa-active-material-id";

export interface MaterialRevisionPrefill {
  message: string;
  materialId: string;
}

/**
 * A Binder deep link may select one stored id, but it cannot inject arbitrary
 * words into chat. The authenticated page and Eve channel each re-scope the id
 * to the signed-in family before any stored material reaches the agent.
 */
export function materialRevisionDraft(input: {
  draft?: string;
  materialId?: string;
}): MaterialRevisionPrefill | undefined {
  if (
    input.draft !== "revise-material"
    || !input.materialId
    || !UUID_PATTERN.test(input.materialId)
  ) {
    return undefined;
  }
  return {
    message: "Keep this layout, but ",
    materialId: input.materialId,
  };
}

export function materialIdFromHeader(value: string | null): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

/**
 * Bind the selected material only while the parent is sending the prepared
 * Binder request. She may finish the sentence, but replacing the opening with
 * an unrelated message drops the object reference.
 */
export function withActiveMaterialHeader(input: {
  headers: Readonly<Record<string, string>>;
  visibleMessage: string | null;
  initialMessage?: string;
  materialId?: string;
}): Readonly<Record<string, string>> {
  const prefix = input.initialMessage?.trimEnd();
  if (
    !input.materialId
    || !UUID_PATTERN.test(input.materialId)
    || !prefix
    || !input.visibleMessage?.startsWith(prefix)
  ) {
    return input.headers;
  }
  return {
    ...input.headers,
    [ACTIVE_MATERIAL_HEADER]: input.materialId,
  };
}
