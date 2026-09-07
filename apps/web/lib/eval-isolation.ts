/**
 * Eval-host isolation (2026-07-25).
 *
 * `eve eval` loads apps/web/.env.local wholesale before anything else runs
 * (eve 0.19.0 dist: evals/cli/eval.js calls loadDevelopmentEnvironmentFiles
 * as its first action), so a local eval run used to hold every production
 * credential. Passing routing evals wrote family_id-null agent_tool_calls
 * rows into the production database, and create_printable rendered real
 * PDFs into the production Blob store (observed 2026-07-25 during the
 * PR #144 routing-eval investigation).
 *
 * The eval host executes evals/evals.config.ts after the first dotenv load.
 * Eve 0.19 reloads those files when its in-process development server starts,
 * so deleting credentials once is insufficient (#1143). The config installs
 * a process-lifetime barrier against restoring the exact durable credential
 * names. eval:sandbox also scrubs the environment before spawning and installs
 * that barrier with a Node preload, before any child application code runs.
 * Model OIDC authentication and read-only research APIs remain available.
 *
 * Two in-code layers back the scrub up, both keyed on the isolation flag
 * this module sets:
 *   - resolveMapDbTarget (lib/map/db.ts) refuses the production pooler
 *     while isolation is active, and honors HOMA_EVAL_DATABASE_URL so
 *     scripts/eval-sandbox.mts can point the run at a disposable local
 *     Postgres with the real migrations applied.
 *   - blobConfigured (lib/materials/artifact-store.ts) reports the
 *     artifact store as absent while isolation is active, which is the
 *     honest degraded path create_printable already had.
 *
 * Escape hatch: HOMA_EVAL_ALLOW_PROD_WRITES=1 restores the old behavior
 * on purpose (for example to reproduce a production-only telemetry bug).
 * Everything here is a no-op on Vercel, same guard as the eval family
 * fixture: a deployed runtime never has its environment edited.
 */

import {
  DURABLE_WRITE_ENV_VARS,
  installEvalIsolationBarrier,
} from "./eval-isolation-runtime.mjs";

export { DURABLE_WRITE_ENV_VARS };

/** Set to "1" by applyEvalIsolation; consumed by the in-code guards. */
export const EVAL_ISOLATION_FLAG = "HOMA_EVAL_ISOLATION";

/** Explicit opt-out: run evals against production credentials anyway. */
export const EVAL_ALLOW_PROD_WRITES_FLAG = "HOMA_EVAL_ALLOW_PROD_WRITES";

/**
 * A Postgres URL for durable writes during eval runs, set by
 * scripts/eval-sandbox.mts. lib/map/db.ts honors it off Vercel only.
 */
export const EVAL_DATABASE_URL_VAR = "HOMA_EVAL_DATABASE_URL";

export type EvalIsolationMode =
  /** Durable-write credentials removed; writes fail closed or land in the sandbox. */
  | "scrubbed"
  /** HOMA_EVAL_ALLOW_PROD_WRITES=1: nothing touched, old contaminating behavior on purpose. */
  | "prod-writes-allowed"
  /** Running on Vercel: never edit a deployed runtime's environment. */
  | "left-alone-on-vercel";

/** Set by scripts/eval-sandbox.mts; honored by lib/materials/eval-blob-store.ts. */
export const EVAL_BLOB_DIR_ENV_VAR = "HOMA_EVAL_BLOB_DIR";
export const EVAL_BLOB_URL_ENV_VAR = "HOMA_EVAL_BLOB_URL";

export interface EvalIsolationResult {
  mode: EvalIsolationMode;
  /** The variables that were present and removed. */
  scrubbed: string[];
  /** Where direct Postgres writes will land for this run. */
  databaseTarget: "sandbox" | "none" | "production";
  /** Where artifact uploads will land for this run. */
  blobTarget: "sandbox" | "none" | "production";
}

/**
 * True while the current process is an isolated eval run. The in-code
 * guards (db target, blob) key on this. The VERCEL check mirrors the
 * eval family fixture: even a leaked flag cannot change a deployed
 * runtime, and the opt-out flag turns the guards off together with the
 * scrub so the escape hatch is one switch, not three.
 */
export function isEvalIsolationActive(
  environment: Record<string, string | undefined>,
): boolean {
  return (
    environment[EVAL_ISOLATION_FLAG] === "1" &&
    environment.VERCEL === undefined &&
    environment[EVAL_ALLOW_PROD_WRITES_FLAG] !== "1"
  );
}

/**
 * Remove durable-write credentials from the eval run's environment.
 * Mutates the record it is given. For process.env, also prevents later dotenv
 * reloads from restoring the credentials. Plain records remain pure fixtures
 * or child environment preparation; the child installs its own preload.
 */
export function applyEvalIsolation(
  environment: Record<string, string | undefined>,
): EvalIsolationResult {
  if (environment.VERCEL !== undefined) {
    return {
      mode: "left-alone-on-vercel",
      scrubbed: [],
      databaseTarget: "production",
      blobTarget: "production",
    };
  }
  if (environment[EVAL_ALLOW_PROD_WRITES_FLAG] === "1") {
    return {
      mode: "prod-writes-allowed",
      scrubbed: [],
      databaseTarget: "production",
      blobTarget: "production",
    };
  }

  const scrubbed: string[] = [];
  for (const name of DURABLE_WRITE_ENV_VARS) {
    if (environment[name] !== undefined) {
      delete environment[name];
      scrubbed.push(name);
    }
  }
  environment[EVAL_ISOLATION_FLAG] = "1";
  if (environment === process.env) installEvalIsolationBarrier();

  return {
    mode: "scrubbed",
    scrubbed,
    databaseTarget: environment[EVAL_DATABASE_URL_VAR] ? "sandbox" : "none",
    blobTarget:
      environment[EVAL_BLOB_DIR_ENV_VAR] && environment[EVAL_BLOB_URL_ENV_VAR]
        ? "sandbox"
        : "none",
  };
}

/** The one line the eval host prints about isolation. */
export function describeEvalIsolation(result: EvalIsolationResult): string {
  switch (result.mode) {
    case "left-alone-on-vercel":
      return "[eval-isolation] running on Vercel, environment left alone";
    case "prod-writes-allowed":
      return (
        "[eval-isolation] WARNING: HOMA_EVAL_ALLOW_PROD_WRITES=1, this run " +
        "holds production credentials and its writes land in production"
      );
    case "scrubbed": {
      const database =
        result.databaseTarget === "sandbox"
          ? "database writes go to the sandbox Postgres"
          : "database writes are disabled (run `pnpm eval:sandbox` for a disposable database)";
      const blob =
        result.blobTarget === "sandbox"
          ? "artifacts go to the sandbox blob store"
          : "the artifact store is off";
      const removed =
        result.scrubbed.length > 0
          ? `removed ${result.scrubbed.join(", ")}`
          : "no durable-write credentials were present";
      return `[eval-isolation] ${removed}; ${database}; ${blob}; model gateway untouched`;
    }
  }
}
