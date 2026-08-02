-- A family deletion is also a privacy deletion boundary. Historical analytics
-- rows must not outlive the family whose activity they describe.
--
-- The table lock closes the race between removing existing orphans and
-- validating the foreign key. Null family_id rows remain valid for anonymous
-- waitlist events.
begin;

lock table public.events in share row exclusive mode;

delete from public.events as event
where event.family_id is not null
  and not exists (
    select 1
    from public.families as family
    where family.id = event.family_id
  );

create index events_family_id_idx
  on public.events (family_id)
  where family_id is not null;

alter table public.events
  add constraint events_family_id_fkey
  foreign key (family_id)
  references public.families (id)
  on delete cascade;

commit;
