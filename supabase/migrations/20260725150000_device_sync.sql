-- Device sync mailbox (mac-mini Homa to cloud, plan: homa-macmini
-- operations/spec-vault-move-and-cloud-sync.md Part 2 v2, 2026-07-25).
--
-- The always-on mac mini that runs the founders' original OpenClaw Homa
-- pushes distilled family signal (curated memories, profile patches,
-- journal-day insights) into an append-only mailbox, and a server-side
-- cron applies each event through the existing gate libraries
-- (saveFamilyMemory, updateChildProfilePinned). The device authenticates
-- with a revocable token resolved server-side to one family; family_id is
-- stamped by the server from that row and never accepted from a payload,
-- the same channel-identity trust basis as the Telnyx phone mapping.
--
-- Additive only, prod-safe on its own: nothing reads or writes these
-- tables until the flag-dark sync routes ship, and no existing table
-- changes shape. Same deny-all posture as link_tokens and the
-- self-improving tables: RLS on, zero client policies, explicit revokes
-- so a Data API role gets a permission error, not an empty 200
-- (scripts/isolation-check.mjs enforces this contract in CI).

create table if not exists public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Operator-facing label ("mac-mini"), for admin reading only.
  name text not null check (char_length(name) between 2 and 60),
  -- sha256 hex of the bearer token; the token itself never touches the
  -- database, same shape as link_tokens.token_hash.
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists sync_devices_token_hash_idx
  on public.sync_devices (token_hash);
create index if not exists sync_devices_family_idx
  on public.sync_devices (family_id);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  device_id uuid not null references public.sync_devices (id) on delete cascade,
  -- v1 writes only 'device'; 'cloud' is reserved so a future reverse-push
  -- mechanism can share the table without a reshape.
  origin text not null default 'device' check (origin in ('device', 'cloud')),
  kind text not null check (char_length(kind) between 2 and 60),
  schema_version int not null default 1 check (schema_version >= 1),
  -- Content-hash or natural-key idempotency, per-kind convention; the
  -- unique index below makes a replayed push a no-op at the medium.
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  payload jsonb not null,
  -- Producer clock (the mini's), for debugging skew; created_at is the
  -- ordering truth.
  produced_at timestamptz not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'skipped', 'error', 'parked')),
  attempts int not null default 0,
  processed_at timestamptz,
  -- Terminal detail: the applier's skip reason or dead-letter error text.
  error text,
  constraint sync_events_payload_cap check (pg_column_size(payload) <= 32768),
  constraint sync_events_dedupe unique (family_id, kind, dedupe_key)
);

create index if not exists sync_events_drain_idx
  on public.sync_events (status, created_at)
  where status = 'pending';
create index if not exists sync_events_family_idx
  on public.sync_events (family_id, created_at desc);

alter table public.sync_devices enable row level security;
alter table public.sync_events enable row level security;

-- No client policies on purpose, and explicit revokes on top: these rows
-- are minted, read, and applied only through the app's own server
-- connection (lib/sync/store.ts). Not even a family member reads them
-- over the Data API; the device reads its pull deltas through the token
-- gated server route, which re-scopes to the token's family.
revoke all on table public.sync_devices from anon, authenticated;
revoke all on table public.sync_events from anon, authenticated;
