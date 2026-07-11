export interface ExistingInboundReceipt {
  status: "claimed" | "completed" | "failed";
  claimedAt: Date;
}

const CLAIM_LEASE_MS = 30 * 60_000;

export function mayClaimInboundReceipt(
  existing: ExistingInboundReceipt | null,
  now: Date,
): boolean {
  if (!existing) return true;
  if (existing.status === "failed") return true;
  if (existing.status === "completed") return false;
  return now.getTime() - existing.claimedAt.getTime() > CLAIM_LEASE_MS;
}
