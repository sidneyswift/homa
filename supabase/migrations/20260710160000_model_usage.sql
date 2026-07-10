-- Migration #43: model_usage, the per-family AI consumption ledger
-- (founder direction 2026-07-10 morning: "track consumption by user
-- across image models, video models, and LLMs; keep everything through
-- the gateway"). MS-6 in plans/2026-07-10-materials-studio-v2.md.
--
-- One append-only row per model call, every modality, every channel:
-- chat turns (recorded by agent/hooks/record-usage.ts from eve's
-- step.completed usage), plus every direct AI SDK call site (images,
-- artifact review, report/plan narratives, curriculum, memory
-- extraction, embeddings). Raw quantities only, never dollar amounts:
-- prices drift, so the future action_costs registry
-- (08-billing-credits-design.md, M1-12/M1-13) joins quantities to a
-- price table at read time. This table is the substrate the credit
-- system prices against; credits themselves stay post-revenue by the
-- standing sequencing decision.
--
-- family_id is nullable (fleet-level work like unattributed embeddings)
-- and set-null on family deletion so fleet spend history survives.
-- surface is free text validated by the TypeScript union in
-- apps/web/lib/model-usage.ts (the one write path), so a new surface
-- never needs a migration.
--
-- Tenancy: deny-all RLS (enable, no policies), matching learning_reviews;
-- only the server connection writes, and no Data API role reads.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.model_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete set null,
  surface text not null,
  channel text check (channel in ('web','sms','email','dispatch')),
  model text not null,
  modality text not null check (modality in ('text','image','embedding')),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cache_read_tokens integer check (cache_read_tokens >= 0),
  cache_write_tokens integer check (cache_write_tokens >= 0),
  images_count integer check (images_count >= 0),
  image_size text,
  duration_ms integer check (duration_ms >= 0),
  session_id text,
  turn_id text,
  provider_metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists model_usage_family_created_idx
  on public.model_usage (family_id, created_at desc);
create index if not exists model_usage_created_idx
  on public.model_usage (created_at desc);

alter table public.model_usage enable row level security;
