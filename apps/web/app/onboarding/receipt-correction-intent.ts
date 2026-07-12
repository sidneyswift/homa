import type { MapAnswer } from "@homa/core";

export interface VersionedReceiptChange {
  answer: MapAnswer;
  version: number;
}

export function snapshotReceiptChanges(
  pending: Readonly<Record<string, VersionedReceiptChange>>,
): Readonly<Record<string, VersionedReceiptChange>> {
  return Object.fromEntries(
    Object.entries(pending).map(([itemId, change]) => [
      itemId,
      { ...change },
    ]),
  );
}

export function clearAcceptedReceiptChanges(
  current: Readonly<Record<string, VersionedReceiptChange>>,
  submitted: Readonly<Record<string, VersionedReceiptChange>>,
): Record<string, VersionedReceiptChange> {
  return Object.fromEntries(
    Object.entries(current).filter(([itemId, change]) => {
      const sent = submitted[itemId];
      return (
        sent === undefined ||
        sent.version !== change.version ||
        sent.answer !== change.answer
      );
    }),
  );
}
