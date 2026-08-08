import { mapDb } from "./map/db";

const ACCESS_DENIED_MESSAGE = "Family artifact access is unavailable.";
const CLEANUP_UNCONFIRMED_MESSAGE =
  "Family artifact access is unavailable and cleanup could not be confirmed.";
type AccountDeletionArtifactFenceReason = "access-denied" | "cleanup-unconfirmed";

export interface AccountDeletionArtifactFenceDependencies {
  isFamilyArtifactAccessAllowed: (familyId: string) => Promise<boolean>;
}

export interface FamilyArtifactWrite<T> {
  familyId: string;
  write: () => Promise<T>;
  cleanup: (artifact: T) => Promise<void>;
}

export class AccountDeletionArtifactFenceError extends Error {
  readonly code = "ACCOUNT_DELETION_ARTIFACT_FENCE";

  constructor(reason: AccountDeletionArtifactFenceReason = "access-denied") {
    super(
      reason === "cleanup-unconfirmed"
        ? CLEANUP_UNCONFIRMED_MESSAGE
        : ACCESS_DENIED_MESSAGE,
    );
    this.name = "AccountDeletionArtifactFenceError";
  }
}

async function isFamilyArtifactAccessAllowed(familyId: string): Promise<boolean> {
  const sql = mapDb();
  const [row] = await sql<Array<{ allowed: boolean }>>`
    select exists (
      select 1
      from public.families family
      where family.id = ${familyId}::uuid
        and family.status <> 'deleted'
        and not exists (
          select 1
          from public.account_deletion_artifact_tombstones tombstone
          where tombstone.family_id = family.id
        )
    ) as allowed
  `;
  return row?.allowed === true;
}

const productionDependencies: AccountDeletionArtifactFenceDependencies = {
  isFamilyArtifactAccessAllowed,
};

/**
 * Fail-closed guard for artifact access and signed upload or download token
 * issuance. The error intentionally carries no family or artifact data.
 */
export async function assertFamilyArtifactAccess(
  familyId: string,
  dependencies: AccountDeletionArtifactFenceDependencies = productionDependencies,
): Promise<void> {
  let allowed = false;
  try {
    allowed = await dependencies.isFamilyArtifactAccessAllowed(familyId);
  } catch {
    throw new AccountDeletionArtifactFenceError();
  }
  if (!allowed) {
    throw new AccountDeletionArtifactFenceError();
  }
}

/**
 * Guards a durable artifact write on both sides of the external operation.
 * If account deletion commits while the write is in flight, the newly written
 * artifact is removed before the caller receives the fail-closed result.
 */
export async function withFamilyArtifactWriteFence<T>(
  input: FamilyArtifactWrite<T>,
  dependencies: AccountDeletionArtifactFenceDependencies = productionDependencies,
): Promise<T> {
  await assertFamilyArtifactAccess(input.familyId, dependencies);
  const artifact = await input.write();

  try {
    await assertFamilyArtifactAccess(input.familyId, dependencies);
  } catch {
    try {
      await input.cleanup(artifact);
    } catch {
      throw new AccountDeletionArtifactFenceError("cleanup-unconfirmed");
    }
    throw new AccountDeletionArtifactFenceError();
  }

  return artifact;
}
