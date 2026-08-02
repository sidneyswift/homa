-- Canonical capture-loop events carry a client-generated UUID so an
-- acknowledged native retry cannot create a second product win. Scope the
-- uniqueness key to the authenticated family to avoid cross-family denial.
create unique index events_capture_loop_event_id_uidx
  on public.events (family_id, ((props ->> 'event_id')))
  where name = 'product.loop_stage_recorded';

create index events_capture_loop_lookup_idx
  on public.events (family_id, ((props ->> 'loop_id')), created_at)
  where name = 'product.loop_stage_recorded';

create index events_capture_loop_stage_time_idx
  on public.events (((props ->> 'stage')), created_at)
  where name = 'product.loop_stage_recorded';
