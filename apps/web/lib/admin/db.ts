import postgres from "postgres";

/**
 * Server-only Postgres client for the founder console (MJ-14), separate
 * from mapDb() for two load-bearing reasons found the hard way
 * (2026-07-12, local probes against the live pooler):
 *
 *   1. max: 1. Through the Supabase transaction pooler a postgres.js
 *      pool with max > 1 deadlocked when a third query arrived while
 *      the second connection was still being established (max 2 plus
 *      three parallel one-row selects hung forever; max 1 with seven
 *      parallel selects was fine). The console fans out wide
 *      Promise.all batches, so it gets one connection and perfect
 *      serialization: a dozen tiny reads cost milliseconds.
 *
 *   2. fetch_types: false, and NO pipelining. Pipelined batches on one
 *      pooler connection also deadlocked (an array_agg column pausing
 *      the pipeline for a type-OID fetch was one trigger; plain batches
 *      reproduced it too). So the rule for every module using this
 *      client: run queries SEQUENTIALLY (await one at a time, never
 *      Promise.all), cast timestamps to ::text, counts to ::int, and
 *      aggregate lists with json_agg(...)::text, never array_agg.
 *
 * Never import this from client code or from family-facing paths; the
 * product keeps using mapDb().
 */

let client: ReturnType<typeof postgres> | undefined;

export function adminDb(): ReturnType<typeof postgres> {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) {
    throw new Error("admin db: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD must be set");
  }
  const ref = new URL(supabaseUrl).hostname.split(".")[0];

  client = postgres({
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    username: `postgres.${ref}`,
    password,
    ssl: "require",
    prepare: false,
    // ONE connection on purpose; see the header comment before raising it.
    max: 1,
    // No lazy type-OID fetches mid-pipeline; see header reason 2.
    fetch_types: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return client;
}
