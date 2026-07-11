-- Migration #41: worksheets, the durable record behind the worksheet
-- studio (FR-5 first real slice; agentic worksheet loop, founder ask
-- 2026-07-09 late night: "Alessa asks over SMS, Homa designs it, sends
-- it back, she critiques, Homa remakes it").
--
-- One row per rendered artifact (a revision is a NEW row; the loop is
-- append-only so "the one before this" always exists). The bytes live
-- in Vercel Blob (BUILD.md law #2: Postgres is truth, Blob for
-- artifacts); this table holds the URLs and the compositional record
-- (title, skill, the html the agent wrote) so a future revision or a
-- reprint never depends on conversation history.
--
-- Tenancy law (BUILD.md #1): family-scoped, is_family_member RLS.
-- Writes: the chat tool inserts under the caller's own JWT (insert
-- policy below, child coherence re-checked at the database); SMS and
-- other pinned channels insert through the server-only connection,
-- which pins family_id from channel auth (lib/agent-pinned posture).
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Null means not tied to one child (a family game board, say).
  child_id uuid references public.children (id) on delete set null,
  title text not null check (char_length(title) <= 90),
  -- What it practices, e.g. "letter O tracing" (future what_works key).
  skill text check (char_length(skill) <= 120),
  pdf_url text not null,
  preview_url text not null,
  -- The full page HTML the agent composed, kept so a later session can
  -- revise the exact artifact instead of re-imagining it.
  html text not null check (char_length(html) <= 120000),
  channel text not null default 'web'
    check (channel in ('web','sms','email','dispatch')),
  created_at timestamptz not null default now()
);

create index if not exists worksheets_family_created_idx
  on public.worksheets (family_id, created_at desc);

alter table public.worksheets enable row level security;

drop policy if exists "members read their worksheets" on public.worksheets;
create policy "members read their worksheets"
  on public.worksheets for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members add worksheets" on public.worksheets;
create policy "members add worksheets"
  on public.worksheets for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = worksheets.family_id
      )
    )
  );

drop policy if exists "members remove their worksheets" on public.worksheets;
create policy "members remove their worksheets"
  on public.worksheets for delete to authenticated
  using (public.is_family_member(family_id));
