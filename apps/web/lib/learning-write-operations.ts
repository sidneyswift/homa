import { createHash } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { mapDb, type DbJson } from "./map/db";

export type LearningTransaction = postgres.TransactionSql;
export const sourceActivityOrdinalSchema = z.number().int().min(1).max(32)
  .describe("This distinct activity's position in the current parent message, starting at 1. Keep the same ordinal on retry, including repeated identical phrases.");

export function learningMutationUuid(seed: string, slot: string): string {
  const bytes = createHash("sha256").update(`${seed}:${slot}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface LearningOperation {
  familyId: string;
  key: string;
  sourceMessageId: string;
  sourceQuote: string;
  request: DbJson;
  hoursIds: readonly string[];
  requestedDate: string | null;
}
export interface LearningOperationClaim {
  id: string;
  inserted: boolean;
  resolvedDate: string;
  outcome: Record<string, unknown> | null;
}

/** The operation and its effects share one transaction. A rejected attempt leaves no claim. */
export async function withLearningWriteOperation<T extends { status: string }>(
  input: LearningOperation,
  effect: (tx: LearningTransaction, claim: LearningOperationClaim) => Promise<T>,
): Promise<T> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    await tx`set local statement_timeout = '15s'`;
    await tx`set local lock_timeout = '5s'`;
    const id = learningMutationUuid(input.key, "operation");
    const [row] = await tx<{ claim: LearningOperationClaim }[]>`
      select public.claim_learning_write_operation(${input.familyId}::uuid, ${id}::uuid, ${input.key},
        ${input.sourceMessageId}::uuid, ${input.sourceQuote}, ${tx.json(input.request)},
        ${tx.array([...input.hoursIds])}::uuid[], ${input.requestedDate}::date) as claim
    `;
    if (!row?.claim || (!row.claim.inserted && !row.claim.outcome)) {
      throw new Error("Learning operation receipt unavailable");
    }
    const result = await effect(tx, row.claim);
    if (row.claim.inserted) {
      if (result.status === "recorded" || result.status === "completed") {
        await tx`update public.learning_write_operations set outcome = ${tx.json(result as unknown as DbJson)}
          where id = ${id} and family_id = ${input.familyId} and outcome is null`;
      } else {
        await tx`delete from public.learning_write_operations where id = ${id} and family_id = ${input.familyId} and outcome is null`;
      }
    }
    return result;
  }) as T;
}

export function learningOperationFailure(error: unknown): { conflict: boolean; note: string } | null {
  if (!error || typeof error !== "object") return null;
  const code = "code" in error ? error.code : "cause" in error ? error.cause : null;
  if (code === "P1090") return { conflict: true, note: "This source activity was already accepted with different details. Review its current record; do not change the source ordinal to add it again." };
  if (code === "23505") return { conflict: true, note: "The database could not accept a distinct entry. No new write was confirmed. Review Hours before trying again." };
  if (code === "42501") return { conflict: false, note: "Homa could not verify the current parent message or its owned records. No new write was confirmed." };
  return null;
}
