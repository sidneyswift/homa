-- Eve's runtime sessions contain one adult's private conversation state.
-- Bind every app session and continuation token to the exact authenticated
-- family member before its opaque id can leave the server.

create table if not exists public.eve_web_session_owners (
  id uuid primary key default gen_random_uuid(),
  session_id text unique,
  family_id uuid not null,
  member_user_id uuid not null,
  continuation_token_hash text not null unique,
  continuation_reservation_hash text,
  continuation_reserved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint eve_web_session_owners_member_fk
    foreign key (family_id, member_user_id)
    references public.family_members (family_id, user_id)
    on delete cascade,
  constraint eve_web_session_owners_session_id_check
    check (
      session_id is null
      or (
        session_id = btrim(session_id)
        and char_length(session_id) between 1 and 255
      )
    ),
  constraint eve_web_session_owners_token_hash_check
    check (continuation_token_hash ~ '^[0-9a-f]{64}$'),
  constraint eve_web_session_owners_reservation_hash_check
    check (
      continuation_reservation_hash is null
      or continuation_reservation_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint eve_web_session_owners_reservation_pair_check
    check (
      (continuation_reservation_hash is null) =
      (continuation_reserved_at is null)
    )
);

create index if not exists eve_web_session_owners_member_created_idx
  on public.eve_web_session_owners
    (family_id, member_user_id, created_at desc);

create unique index if not exists eve_web_session_owners_member_provisional_idx
  on public.eve_web_session_owners (family_id, member_user_id)
  where session_id is null;

alter table public.eve_web_session_owners enable row level security;

revoke all on table public.eve_web_session_owners
  from public, anon, authenticated;

comment on table public.eve_web_session_owners is
  'Server-only provisional claims, exact-adult ownership, and continuation serialization for Eve web sessions.';
