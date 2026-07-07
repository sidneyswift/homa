/**
 * State requirements seed (M3-05 data layer, stage 2 of 2).
 *
 * Upserts the reviewed snapshots in data/state-requirements/ into the
 * state_requirements table (migration #21). Run ONLY after
 * pnpm pull:state-requirements and a human read of
 * `git diff data/state-requirements`: this script is the moment upstream
 * legal data becomes product-readable, and the diff review is the
 * quarantine gate (AQ-10 / M3-04 reasoning).
 *
 * Upsert semantics: pulled_at always advances to the manifest's pull
 * time; updated_at moves ONLY when row content actually changed, so it
 * stays an honest "this rule last changed" signal for the product and
 * for blast-radius work (journey J-H).
 *
 * The table has no Data API write policies on purpose; this direct
 * connection (Supabase transaction pooler, server-only DB password) is
 * the only write path, same credential path as scripts/map-norms-report.mts.
 *
 * Usage: pnpm seed:state-requirements
 * Env: apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD).
 * Exit codes: 0 = seeded and verified, 1 = validation or count failure, 2 = missing env.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import {
  EXPECTED_JURISDICTIONS,
  stableStringify,
  type IndexStateEntry,
  type StateDetail,
} from "./state-requirements-shared.mts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(repoRoot, "data", "state-requirements");

try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when the vars arrive via the environment.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!supabaseUrl || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_DB_PASSWORD (apps/web/.env.local)");
  process.exit(2);
}
const ref = new URL(supabaseUrl).hostname.split(".")[0];

const sql = postgres({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  username: `postgres.${ref}`,
  password,
  ssl: "require",
  prepare: false,
  max: 1,
  idle_timeout: 10,
  connect_timeout: 15,
});

type DbJson = Parameters<typeof sql.json>[0];

interface Manifest {
  pulled_at: string;
  jurisdictions: number;
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(dataDir, relativePath), "utf8")) as T;
}

const manifest = await readJson<Manifest>("manifest.json");
const index = await readJson<{ states: IndexStateEntry[] }>("index.json");
const indexByCode = new Map(index.states.map((entry) => [entry.state_code, entry]));

const files = (await readdir(path.join(dataDir, "states"))).filter((name) => name.endsWith(".json")).sort();

const problems: string[] = [];
if (files.length !== EXPECTED_JURISDICTIONS) {
  problems.push(`expected ${EXPECTED_JURISDICTIONS} snapshot files, found ${files.length}`);
}
if (manifest.jurisdictions !== EXPECTED_JURISDICTIONS) {
  problems.push(`manifest says ${manifest.jurisdictions} jurisdictions`);
}

interface Row {
  state_code: string;
  state_name: string;
  regulation_level: string;
  compulsory_start_age: number | null;
  compulsory_end_age: number | null;
  notification_required: boolean;
  assessment_required: boolean;
  default_pathway: string | null;
  payload: StateDetail;
  source_page_url: string | null;
  source_verification_status: string;
  source_last_verified: string;
}

const rows: Row[] = [];
for (const file of files) {
  const detail = await readJson<StateDetail>(path.join("states", file));
  const code = file.replace(".json", "");
  const summary = indexByCode.get(code);
  if (detail.state_code !== code) problems.push(`${file}: payload state_code is ${detail.state_code}`);
  if (!summary) problems.push(`${file}: no matching entry in index.json`);
  if (!Array.isArray(detail.pathways) || detail.pathways.length === 0) problems.push(`${file}: no pathways`);
  if (!detail.verification_status || !detail.last_verified) problems.push(`${file}: missing verification fields`);
  if (!summary) continue;
  rows.push({
    state_code: code,
    state_name: detail.state_name,
    regulation_level: detail.regulation_level,
    compulsory_start_age: detail.compulsory_education?.start_age ?? null,
    compulsory_end_age: detail.compulsory_education?.end_age ?? null,
    notification_required: summary.notification_required,
    assessment_required: summary.assessment_required,
    default_pathway: summary.default_pathway ?? null,
    payload: detail,
    source_page_url: detail.page_url ?? null,
    source_verification_status: detail.verification_status,
    source_last_verified: detail.last_verified,
  });
}

if (problems.length > 0) {
  console.error(`Snapshot validation failed, nothing written:\n  ${problems.join("\n  ")}`);
  await sql.end();
  process.exit(1);
}

// Diff against what the table holds now, so the summary reports real
// change (and updated_at only moves for changed rows). Both sides go
// through stableStringify because Postgres jsonb reorders object keys.
const existing = await sql<{ state_code: string; payload: unknown }[]>`
  select state_code, payload from public.state_requirements
`;
const existingPayloads = new Map(existing.map((row) => [row.state_code, stableStringify(row.payload)]));

let inserted = 0;
let changed = 0;
let unchanged = 0;

for (const row of rows) {
  const before = existingPayloads.get(row.state_code);
  if (before === undefined) inserted += 1;
  else if (before === stableStringify(row.payload)) unchanged += 1;
  else changed += 1;

  await sql`
    insert into public.state_requirements (
      state_code, state_name, regulation_level,
      compulsory_start_age, compulsory_end_age,
      notification_required, assessment_required, default_pathway,
      payload, source_page_url, source_verification_status,
      source_last_verified, pulled_at
    ) values (
      ${row.state_code}, ${row.state_name}, ${row.regulation_level},
      ${row.compulsory_start_age}, ${row.compulsory_end_age},
      ${row.notification_required}, ${row.assessment_required}, ${row.default_pathway},
      ${sql.json(row.payload as unknown as DbJson)}, ${row.source_page_url}, ${row.source_verification_status},
      ${row.source_last_verified}, ${manifest.pulled_at}
    )
    on conflict (state_code) do update set
      state_name = excluded.state_name,
      regulation_level = excluded.regulation_level,
      compulsory_start_age = excluded.compulsory_start_age,
      compulsory_end_age = excluded.compulsory_end_age,
      notification_required = excluded.notification_required,
      assessment_required = excluded.assessment_required,
      default_pathway = excluded.default_pathway,
      payload = excluded.payload,
      source_page_url = excluded.source_page_url,
      source_verification_status = excluded.source_verification_status,
      source_last_verified = excluded.source_last_verified,
      pulled_at = excluded.pulled_at,
      updated_at = case
        when state_requirements.payload is distinct from excluded.payload
          or state_requirements.notification_required is distinct from excluded.notification_required
          or state_requirements.assessment_required is distinct from excluded.assessment_required
        then now()
        else state_requirements.updated_at
      end
  `;
}

const [{ count }] = await sql<{ count: number }[]>`
  select count(*)::int as count from public.state_requirements
`;
await sql.end();

console.log(
  `Seeded state_requirements from snapshots pulled ${manifest.pulled_at}: ` +
    `${inserted} inserted, ${changed} changed, ${unchanged} unchanged. Table now holds ${count} rows.`,
);
if (count !== EXPECTED_JURISDICTIONS) {
  console.error(`Row count ${count} does not match the expected ${EXPECTED_JURISDICTIONS}. Investigate.`);
  process.exit(1);
}
if (changed > 0) {
  console.log("Changed rows mean families may see updated rules; if any change is user-visible, follow the runbook's correction steps.");
}
