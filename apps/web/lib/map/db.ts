import postgres from "postgres";

/**
 * Server-only Postgres client for the map lead tables (migration #7).
 * The lead_* tables are deny-all for every Data API role, so this direct
 * connection (Supabase transaction pooler) is the ONLY path to them, and it
 * exists exclusively inside server routes. Never import this from client
 * code; "postgres" has no browser build, so a mistake fails the build loudly.
 *
 * Env: SUPABASE_DB_PASSWORD (server-only secret, set in Vercel + .env.local).
 * Host and user derive from NEXT_PUBLIC_SUPABASE_URL's project ref.
 */

let client: ReturnType<typeof postgres> | undefined;

/** The exact value type postgres.js accepts for jsonb parameters. */
export type DbJson = Parameters<ReturnType<typeof postgres>["json"]>[0];

export function mapDb(): ReturnType<typeof postgres> {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) {
    throw new Error("map db: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD must be set");
  }
  const ref = new URL(supabaseUrl).hostname.split(".")[0];

  client = postgres({
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    username: `postgres.${ref}`,
    password,
    ssl: "require",
    // Transaction pooler: no prepared statements, small per-lambda pool.
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return client;
}
