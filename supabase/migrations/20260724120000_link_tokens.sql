-- Durable multi-token resume links
-- (docs/homa-planning/plans/2026-07-21-chat-first-onboarding.md, Phase 2:
-- "build the deferred link_tokens table, multi-email sequences dead-link
-- without it").
--
-- families.link_token_hash is a single overwritten column: minting a new
-- link invalidates whichever earlier email still held the last one. That
-- was fine while the drip sent one nudge kind at a time, but the new
-- beat-keyed audiences (mid-checklist, kid-2-pending,
-- revealed-never-returned) can each mint their own link for the same
-- family, and an earlier email's link must keep working after a later one
-- is sent.
--
-- Additive only, prod-safe on its own: nothing reads or writes this table
-- yet, and the existing single-column mechanism (mintLinkToken,
-- families.link_token_hash) is untouched, so drip_setup_nudge keeps
-- working exactly as it does today. The new audiences mint through this
-- table instead (lib/map/store.ts's mintNamedLinkToken).
create table if not exists public.link_tokens (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  token_hash text not null,
  -- Which audience minted it, for admin/debug reading only; resolution
  -- never branches on this.
  kind text not null check (char_length(kind) between 2 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists link_tokens_hash_idx
  on public.link_tokens (token_hash);
create index if not exists link_tokens_family_idx
  on public.link_tokens (family_id, created_at desc);

alter table public.link_tokens enable row level security;

-- No client policies on purpose, same posture as agent_schedules: minted
-- and resolved only from the server connection
-- (lib/map/store.ts:getFamilyByResumeToken / mintNamedLinkToken), never
-- through the Data API.
