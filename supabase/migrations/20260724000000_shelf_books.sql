-- Migration: shelf_books — Carolyng's ask (2026-07-19): a place for
-- families to upload photos of their homeschool books and reference
-- texts so Homa can reference them when building lessons and unit
-- studies. Cover photo required, table-of-contents photo optional.
--
-- Tenancy law (BUILD.md #1): family-scoped, is_family_member RLS.
-- Photos live in Vercel Blob (BUILD.md law #2: Postgres is truth,
-- Blob for artifacts).

create table if not exists public.shelf_books (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  author text check (char_length(author) <= 200),
  cover_url text not null,
  toc_url text,
  notes text check (char_length(notes) <= 2000),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shelf_books_family_status_idx
  on public.shelf_books (family_id, status, created_at desc);

alter table public.shelf_books enable row level security;

create policy "members read their shelf books"
  on public.shelf_books for select to authenticated
  using (public.is_family_member(family_id));

create policy "members add shelf books"
  on public.shelf_books for insert to authenticated
  with check (public.is_family_member(family_id));

create policy "members update their shelf books"
  on public.shelf_books for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "members remove their shelf books"
  on public.shelf_books for delete to authenticated
  using (public.is_family_member(family_id));
