/**
 * The truthful save-failure note (HOMA-M5, 2026-07-19): create_printable's
 * old note always told the agent to re-check the child id, and when the
 * real cause was an RLS policy bug on the revises column the agent chased
 * child ids while nothing could save. Only a failure whose error text
 * actually points at the child (the child_id foreign key, the child
 * re-scope check) earns that suggestion; everything else is reported as
 * what it is, a storage-side failure the agent cannot fix by changing
 * input ids. Either way the note stays honest: nothing was persisted.
 */
export function materialSaveFailureNote(
  error: {
    code?: string | null;
    message?: string | null;
    details?: string | null;
  } | null,
  hadChildId: boolean,
): string {
  const reason = error?.message?.trim() || "unknown database error";
  const mentionsChild = /child/i.test(
    `${error?.message ?? ""} ${error?.details ?? ""}`,
  );
  if (hadChildId && mentionsChild) {
    return `Nothing was saved: the material record insert failed (${reason}). The error points at the child id; use one from the family context block and call again.`;
  }
  return `Nothing was saved: the material record insert failed (${reason}). This is a storage-side failure, not a wrong child id, so do not retry with different ids; tell the parent plainly that the material could not be saved right now.`;
}
