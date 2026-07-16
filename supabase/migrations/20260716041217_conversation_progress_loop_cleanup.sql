create or replace function private.cancel_stale_progress_reply_loops()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversation_open_loops loop
  set state = 'cancelled'
  where loop.family_id = new.family_id
    and loop.state = 'open'
    and loop.prompt_key like
      'progress-check-in:' || new.id::text || ':revision:%'
    and (
      new.state <> 'active'
      or new.current_delivery_id is null
      or loop.delivery_id <> new.current_delivery_id
      or loop.prompt_key <>
        'progress-check-in:' || new.id::text ||
        ':revision:' || new.revision::text
    );
  return new;
end
$$;

revoke all on function private.cancel_stale_progress_reply_loops()
  from public, anon, authenticated;

drop trigger if exists progress_check_ins_cancel_stale_reply_loops
  on public.progress_check_ins;
create trigger progress_check_ins_cancel_stale_reply_loops
after update of state, revision, current_delivery_id
on public.progress_check_ins
for each row execute function
  private.cancel_stale_progress_reply_loops();

update public.conversation_open_loops loop
set state = 'cancelled'
from public.progress_check_ins check_in
where loop.family_id = check_in.family_id
  and loop.state = 'open'
  and loop.prompt_key like
    'progress-check-in:' || check_in.id::text || ':revision:%'
  and (
    check_in.state <> 'active'
    or check_in.current_delivery_id is null
    or loop.delivery_id <> check_in.current_delivery_id
    or loop.prompt_key <>
      'progress-check-in:' || check_in.id::text ||
      ':revision:' || check_in.revision::text
  );
