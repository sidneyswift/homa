-- Migration #80: chat_attachments, the durable record of files a parent
-- attaches in web chat (approved chat redesign, plans/
-- 2026-07-13-chat-refined.html: "photo is also saved with the child's
-- records, findable later"). Additive only, safe to lead the deploy.
--
-- Where the bytes live: Vercel Blob under families/{familyId}/chat/
-- (public store, random-suffix URLs, the materials posture). This table
-- is the findable record: which family, optionally which child (the
-- context switcher's selection at send time, validated against the
-- family's own children server-side), what kind of thing, and the
-- one-line caption that also rides the conversation text for recall.
--
-- Tenancy: members read their own family's rows (the binder and future
-- child-record surfaces read under the caller's RLS). There is
-- deliberately NO insert/update/delete policy for authenticated: rows
-- are written and removed only by the server-side attachment routes
-- (family id from the caller's session, never from the request body),
-- the same posture as conversation_messages.

create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- The kid this was filed under, when one was selected; null = whole
  -- family. set null on child deletion: the file outlives the profile.
  child_id uuid references public.children (id) on delete set null,
  -- Which adult sent it (auth.users id, plain uuid like
  -- family_members.user_id); display + per-adult views later.
  member_user_id uuid,
  url text not null,
  media_type text not null,
  kind text not null
    check (kind in ('image', 'audio', 'video', 'document', 'text', 'other')),
  -- The searchable one-liner (image caption, filename for files).
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists chat_attachments_family_idx
  on public.chat_attachments (family_id, created_at desc);
create index if not exists chat_attachments_child_idx
  on public.chat_attachments (child_id)
  where child_id is not null;

alter table public.chat_attachments enable row level security;

drop policy if exists "members read their chat attachments"
  on public.chat_attachments;
create policy "members read their chat attachments"
  on public.chat_attachments for select to authenticated
  using (public.is_family_member(family_id));

-- Defense-in-depth (migration #56 posture): anon touches nothing, and
-- authenticated keeps only select; writes stay server-only even if a
-- future policy mistake would have allowed them.
revoke all on table public.chat_attachments from anon;
revoke insert, update, delete on table public.chat_attachments from authenticated;
