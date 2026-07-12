import {
  CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
} from "../apps/web/lib/child-progress/postgres-repository-helpers";

export interface ChildProgressReconciliationCounts {
  insertedCount: bigint;
  supersededCount: bigint;
}

export interface ChildProgressReconciliationTransaction {
  acquireExclusiveLock(lockKey: number): Promise<void>;
  reconcile(): Promise<ChildProgressReconciliationCounts>;
}

export interface ChildProgressReconciliationDatabase {
  withTransaction<T>(
    operation: (
      transaction: ChildProgressReconciliationTransaction,
    ) => Promise<T>,
  ): Promise<T>;
}

export type ChildProgressReconciliationResult =
  ChildProgressReconciliationCounts &
    (
      | { mode: "commit"; status: "reconciled" }
      | { mode: "dry-run"; status: "rolled_back" }
    );

class DryRunRollback extends Error {
  constructor(
    readonly counts: ChildProgressReconciliationCounts,
  ) {
    super("Rollback requested for ChildProgress reconciliation dry run");
  }
}

/**
 * Runs the private migration reconciliation under the same exclusive lock
 * used by the SQL function. Dry runs invoke the real function, then roll back.
 */
export async function executeChildProgressReconciliation(input: {
  database: ChildProgressReconciliationDatabase;
  dryRun: boolean;
}): Promise<ChildProgressReconciliationResult> {
  try {
    const counts = await input.database.withTransaction(
      async (transaction) => {
        await transaction.acquireExclusiveLock(
          CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
        );
        const reconciled = await transaction.reconcile();
        if (input.dryRun) {
          throw new DryRunRollback(reconciled);
        }
        return reconciled;
      },
    );
    return {
      mode: "commit",
      ...counts,
      status: "reconciled",
    };
  } catch (error) {
    if (error instanceof DryRunRollback) {
      return {
        mode: "dry-run",
        ...error.counts,
        status: "rolled_back",
      };
    }
    throw error;
  }
}
