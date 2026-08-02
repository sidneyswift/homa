export function captureLoopReceiptLockKey(
  familyId: string,
  receiptId: string,
): string {
  return `capture-loop:receipt:${familyId}:${receiptId}`;
}

export function captureLoopEventLockKey(
  familyId: string,
  eventId: string,
): string {
  return `capture-loop:event:${familyId}:${eventId}`;
}
