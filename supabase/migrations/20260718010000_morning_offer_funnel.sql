-- Cohort-based morning offer analytics and deterministic fulfillment proof.
-- This migration is additive and may lead the code deployment.

alter table public.conversation_open_loops
  add column if not exists resolution_method text,
  add column if not exists classifier_version text;

alter table public.conversation_open_loops
  drop constraint if exists conversation_open_loops_resolution_method_check,
  add constraint conversation_open_loops_resolution_method_check
    check (
      resolution_method is null
      or resolution_method in (
        'explicit_delivery',
        'provider_reply',
        'content_clarification',
        'prompt_key',
        'bounded_polarity',
        'same_channel_free_text',
        'progress_choice',
        'legacy_backfill'
      )
    ),
  drop constraint if exists conversation_open_loops_classifier_version_check,
  add constraint conversation_open_loops_classifier_version_check
    check (
      classifier_version is null
      or (
        char_length(classifier_version) between 1 and 40
        and classifier_version ~ '^[a-z0-9-]+$'
      )
    );

create table if not exists public.conversation_offer_fulfillments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families (id) on delete cascade,
  source_delivery_id uuid not null unique,
  kind text not null check (kind in ('material', 'task')),
  reference_id uuid not null,
  fulfilled_at timestamptz not null default now(),
  constraint conversation_offer_fulfillments_delivery_family_fkey
    foreign key (source_delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on update cascade
    on delete cascade
);

create index if not exists conversation_offer_fulfillments_family_time_idx
  on public.conversation_offer_fulfillments (family_id, fulfilled_at desc);

alter table public.conversation_offer_fulfillments enable row level security;
revoke all on table public.conversation_offer_fulfillments
  from public, anon, authenticated;

-- The outcome column arrived after the continuity ledger. Existing resolved
-- loops already carry a causal inbound message edge, so fill their missing
-- label without inventing causality. Rows without that edge stay null and
-- remain visible as unclassified data quality work.
with legacy_replies as (
  select
    l.id,
    l.kind,
    regexp_replace(
      regexp_replace(lower(btrim(m.content)), '[.!?]+$', '', 'g'),
      '\s+',
      ' ',
      'g'
    ) as normalized
  from public.conversation_open_loops l
  join public.conversation_messages m
    on m.id = l.resolved_by_message_id
   and m.family_id = l.family_id
  where l.state = 'resolved'
    and l.resolved_outcome is null
)
update public.conversation_open_loops l
set
  resolved_outcome = case
    when legacy_replies.kind in ('free_text', 'choice') then 'answered'
    when legacy_replies.normalized = any(array[
      'yes', 'yes please', 'yes, please', 'yep', 'yeah', 'yup', 'sure',
      'okay', 'ok', 'absolutely', 'definitely', 'please do', 'go ahead',
      'do it', 'send it', 'make it', 'create it', 'set it up',
      'schedule it', 'sounds good', 'that sounds good', 'sounds great',
      'that sounds great', 'i''d love that', 'i would love that',
      'that would be great', 'perfect', 'no problem', 'why not'
    ]) then 'accepted'
    when legacy_replies.normalized = any(array[
      'no', 'no thanks', 'no, thanks', 'nope', 'nah', 'not now',
      'not today', 'not this time', 'maybe later', 'later', 'we''re good',
      'we are good', 'no need', 'skip it', 'pass'
    ]) then 'declined'
    else 'answered'
  end,
  resolution_method = coalesce(l.resolution_method, 'legacy_backfill'),
  classifier_version = coalesce(
    l.classifier_version,
    'reply-intent-v2-backfill'
  )
from legacy_replies
where l.id = legacy_replies.id;
