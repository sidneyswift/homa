-- Migration #7: the child's map lead tables (lead magnet v2, decision D3=A).
-- Posture: STRICTER than the waitlist. RLS is enabled with ZERO policies and
-- all privileges are revoked from the public Data API roles, so anon and
-- authenticated can neither read nor write these tables at all. Every access
-- goes through apps/web server routes holding the server-only secret key
-- (the first server secret in the app, anticipated by build-log 2026-07-04 #3).
-- Emails are normalized to lowercase in the app layer before insert.

create table public.lead_families (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  us_state text,
  source text not null default 'organic'
    check (source in ('conference', 'referral', 'organic', 'social', 'other')),
  utm jsonb not null default '{}'::jsonb,
  -- sha256 of the resume token; the raw token lives only in her cookie/email.
  resume_token_hash text,
  status text not null default 'open'
    check (status in ('open', 'complete', 'claimed', 'deleted')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_families_email_lowercase check (email = lower(email)),
  constraint lead_families_email_key unique (email)
);

create table public.lead_children (
  id uuid primary key default gen_random_uuid(),
  lead_family_id uuid not null references public.lead_families (id) on delete cascade,
  name text not null,
  -- Day is always 01, mirroring public.children.birth_month (data we chose
  -- not to hold; age-band math needs month + year only).
  birth_month date not null,
  interests text[] not null default '{}',
  help_with text,
  -- True when the child's age band has no scored question bank yet; the
  -- band-ready job emails the checklist the moment the band ships.
  pending_band boolean not null default false,
  band_ready_emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index lead_children_lead_family_id_idx on public.lead_children (lead_family_id);

create table public.lead_answers (
  lead_child_id uuid not null references public.lead_children (id) on delete cascade,
  -- Bank item id, e.g. 'math.counts-past-20' (packages/core map content).
  question_id text not null,
  answer text not null
    check (answer in ('easily', 'getting_there', 'not_yet', 'not_sure', 'skip')),
  answered_at timestamptz not null default now(),
  -- Upsert on the pair makes every save resume-safe and idempotent.
  primary key (lead_child_id, question_id)
);

create table public.lead_reports (
  id uuid primary key default gen_random_uuid(),
  lead_child_id uuid not null references public.lead_children (id) on delete cascade,
  -- Per-domain positions from the deterministic scorer, plus meta.
  scores jsonb not null,
  -- packages/core MAP_BANK_VERSION that produced the scores (content is
  -- versioned so a later bank correction never silently rewrites a report).
  bank_version text not null,
  -- Unguessable URL token for /map/r/[token]; revocable.
  token text not null,
  generated_at timestamptz not null default now(),
  emailed_at timestamptz,
  viewed_at timestamptz,
  revoked_at timestamptz,
  constraint lead_reports_token_key unique (token),
  constraint lead_reports_child_key unique (lead_child_id)
);

alter table public.lead_families enable row level security;
alter table public.lead_children enable row level security;
alter table public.lead_answers enable row level security;
alter table public.lead_reports enable row level security;

-- No policies on purpose: deny-all for every Data API role. Belt and
-- braces, revoke the table privileges too so probes get 401/403 rather
-- than empty result sets.
revoke all on table public.lead_families from anon, authenticated;
revoke all on table public.lead_children from anon, authenticated;
revoke all on table public.lead_answers from anon, authenticated;
revoke all on table public.lead_reports from anon, authenticated;
