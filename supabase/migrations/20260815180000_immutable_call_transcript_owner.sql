-- A verified call-start owner is durable only on the first transcript insert.
-- Existing calls remain unreadable because there is no retrospective proof.

alter table public.call_transcripts
  add column if not exists owner_provenance text;

alter table public.call_transcripts
  drop constraint if exists call_transcripts_owner_provenance_check;

alter table public.call_transcripts
  add constraint call_transcripts_owner_provenance_check
  check (
    owner_provenance is null
    or owner_provenance = 'telnyx_call_start_v1'
  );

create or replace function public.conversation_guard_call_owner()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- A re-sync may refresh transcript content but can never add, change, or
  -- restore ownership after the original insert. Account deletion is allowed
  -- to erase the owner through the foreign key's ON DELETE SET NULL action.
  if tg_op = 'UPDATE' then
    if old.member_user_id is null then
      new.member_user_id := null;
      new.owner_provenance := null;
    elsif new.member_user_id is null then
      new.owner_provenance := null;
    else
      new.member_user_id := old.member_user_id;
      new.owner_provenance := old.owner_provenance;
    end if;
    return new;
  end if;

  if new.member_user_id is not null
     and new.owner_provenance = 'telnyx_call_start_v1'
     and exists (
       select 1
       from public.family_members member
       where member.family_id = new.family_id
         and member.user_id = new.member_user_id
     ) then
    return new;
  end if;

  new.member_user_id := null;
  new.owner_provenance := null;
  return new;
end
$function$;

comment on column public.call_transcripts.owner_provenance is
  'Only telnyx_call_start_v1 can carry a member owner, and only on the first verified insert.';

comment on function public.conversation_guard_call_owner() is
  'Allows a verified Telnyx call-start owner only on INSERT, then makes ownership immutable and clears unproven rows.';
