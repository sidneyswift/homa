-- Reserve exact fulfillment provenance before a material or task write, then
-- count it only when the referenced deterministic result exists. Protect the
-- material provenance column from direct authenticated writes.

alter table public.conversation_offer_fulfillments
  add column if not exists completed_at timestamptz;

update public.conversation_offer_fulfillments
set completed_at = fulfilled_at
where completed_at is null;

create or replace function private.protect_material_offer_provenance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.source_offer_delivery_id is not null then
      raise insufficient_privilege
        using message = 'offer provenance is server-owned';
    end if;
    if tg_op = 'UPDATE'
      and new.source_offer_delivery_id is distinct from
        old.source_offer_delivery_id
    then
      raise insufficient_privilege
        using message = 'offer provenance is server-owned';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_material_offer_provenance
  on public.materials;
create trigger protect_material_offer_provenance
before insert or update of source_offer_delivery_id
on public.materials
for each row
execute function private.protect_material_offer_provenance();
