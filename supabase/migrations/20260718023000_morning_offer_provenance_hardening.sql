-- Preserve one exact accepted offer across clarification turns and on the
-- deterministic material or task it produces. This replaces episode-time
-- inference with server-owned delivery provenance.

alter table public.conversation_thread_bindings
  add column if not exists pending_offer_delivery_id uuid;

alter table public.conversation_thread_bindings
  drop constraint if exists
    conversation_thread_bindings_pending_offer_delivery_fkey,
  add constraint conversation_thread_bindings_pending_offer_delivery_fkey
    foreign key (pending_offer_delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on update cascade
    on delete set null (pending_offer_delivery_id);

create index if not exists
  conversation_thread_bindings_pending_offer_idx
  on public.conversation_thread_bindings (
    family_id,
    pending_offer_delivery_id
  )
  where pending_offer_delivery_id is not null;

alter table public.materials
  add column if not exists source_offer_delivery_id uuid;

alter table public.materials
  drop constraint if exists materials_source_offer_delivery_fkey,
  add constraint materials_source_offer_delivery_fkey
    foreign key (source_offer_delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on update cascade
    on delete set null (source_offer_delivery_id);

create index if not exists materials_source_offer_delivery_idx
  on public.materials (family_id, source_offer_delivery_id)
  where source_offer_delivery_id is not null;

alter table public.agent_schedules
  add column if not exists source_offer_delivery_id uuid;

alter table public.agent_schedules
  drop constraint if exists agent_schedules_source_offer_delivery_fkey,
  add constraint agent_schedules_source_offer_delivery_fkey
    foreign key (source_offer_delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on update cascade
    on delete set null (source_offer_delivery_id);

create index if not exists agent_schedules_source_offer_delivery_idx
  on public.agent_schedules (family_id, source_offer_delivery_id)
  where source_offer_delivery_id is not null;

-- Classifier v2 stripped terminal question marks before checking exact
-- phrases. Correct only the affected backfill rows, using their already
-- causal message edge, and leave all other historical labels unchanged.
update public.conversation_open_loops loop
set
  resolved_outcome = 'answered',
  classifier_version = 'reply-intent-v3-correction'
from public.conversation_messages message
where loop.resolved_by_message_id = message.id
  and loop.family_id = message.family_id
  and loop.classifier_version = 'reply-intent-v2-backfill'
  and (
    message.content like '%?%'
    or (
      lower(message.content) ~
        '\m(yes|yep|yeah|yup|sure|okay|ok|absolutely|definitely)\M'
      and lower(message.content) ~
        '\m(no|nope|nah|not|never|don''t)\M'
    )
  );
