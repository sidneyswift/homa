import postgres from "postgres";

import {
  EVAL_DATABASE_URL_VAR,
  isEvalIsolationActive,
} from "../eval-isolation";

/**
 * Server-only Postgres client for the map lead tables (migration #7).
 * The lead_* tables are deny-all for every Data API role, so this direct
 * connection (Supabase transaction pooler) is the ONLY path to them, and it
 * exists exclusively inside server routes. Never import this from client
 * code; "postgres" has no browser build, so a mistake fails the build loudly.
 *
 * Env: SUPABASE_DB_PASSWORD (server-only secret, set in Vercel + .env.local).
 * Host and user derive from NEXT_PUBLIC_SUPABASE_URL's project ref.
 *
 * Eval runs are the exception (lib/eval-isolation.ts, 2026-07-25): the eval
 * host inherits .env.local, so without a guard a passing eval writes
 * telemetry into the production pooler. Off Vercel, HOMA_EVAL_DATABASE_URL
 * (set by scripts/eval-sandbox.mts) redirects every mapDb consumer to a
 * disposable local cluster, and an isolated eval run without that variable
 * gets a refusal instead of the pooler.
 */

let client: ReturnType<typeof postgres> | undefined;

/** The exact value type postgres.js accepts for jsonb parameters. */
export type DbJson = Parameters<ReturnType<typeof postgres>["json"]>[0];

export type MapDbTarget =
  | { kind: "eval-sandbox"; url: string }
  | { kind: "supabase-pooler"; ref: string; password: string };

/**
 * Pure target resolution, split out so the eval guard is testable without
 * constructing a client. Order matters: a sandbox URL wins while off
 * Vercel, then active isolation refuses the pooler, then the production
 * path resolves exactly as before. On Vercel the first two branches are
 * unreachable by construction, so a leaked eval variable cannot redirect
 * a deployed runtime.
 */
export function resolveMapDbTarget(
  environment: Record<string, string | undefined>,
): MapDbTarget {
  const evalDatabaseUrl = environment[EVAL_DATABASE_URL_VAR];
  if (evalDatabaseUrl && environment.VERCEL === undefined) {
    return { kind: "eval-sandbox", url: evalDatabaseUrl };
  }
  if (isEvalIsolationActive(environment)) {
    throw new Error(
      "map db: eval isolation is active, refusing the production pooler. " +
        "Run through `pnpm eval:sandbox` for a disposable database, or set " +
        "HOMA_EVAL_ALLOW_PROD_WRITES=1 to target production on purpose.",
    );
  }
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  const password = environment.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) {
    throw new Error("map db: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD must be set");
  }
  return {
    kind: "supabase-pooler",
    ref: new URL(supabaseUrl).hostname.split(".")[0],
    password,
  };
}

export function mapDb(): ReturnType<typeof postgres> {
  if (client) return client;

  const target = resolveMapDbTarget(process.env);
  client =
    target.kind === "eval-sandbox"
      ? postgres(target.url, {
          // The sandbox is a plain local cluster: no TLS, same pool shape.
          prepare: false,
          max: 2,
          idle_timeout: 20,
          connect_timeout: 15,
        })
      : postgres({
          host: "aws-0-us-east-1.pooler.supabase.com",
          port: 6543,
          database: "postgres",
          username: `postgres.${target.ref}`,
          password: target.password,
          ssl: "require",
          // Transaction pooler: no prepared statements, small per-lambda pool.
          prepare: false,
          max: 2,
          idle_timeout: 20,
          connect_timeout: 15,
        });
  return client;
}
