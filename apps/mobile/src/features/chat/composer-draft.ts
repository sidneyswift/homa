export interface ComposerDraftRequest {
  id: string;
  text: string;
}

const MAX_DRAFT_ID_LENGTH = 128;
const MAX_DRAFT_TEXT_LENGTH = 2_000;

function firstParam(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate : null;
}

export function parseComposerDraftRequest(
  idParam: string | string[] | undefined,
  textParam: string | string[] | undefined,
): ComposerDraftRequest | null {
  const id = firstParam(idParam);
  const text = firstParam(textParam);
  if (
    !id
    || id.length > MAX_DRAFT_ID_LENGTH
    || !text
    || text.trim().length === 0
    || text.length > MAX_DRAFT_TEXT_LENGTH
  ) {
    return null;
  }
  return { id, text };
}

export function mergeComposerDraft(current: string, incoming: string): string {
  if (incoming.trim().length === 0) return current;
  if (current.trim().length === 0) return incoming;
  return `${current.trimEnd()}\n\n${incoming}`;
}
