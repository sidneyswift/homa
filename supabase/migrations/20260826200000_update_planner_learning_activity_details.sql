-- Parent-facing edit for a chat-logged Planner item's title and note
-- (Carolyng feedback, 2026-08-26): "edit it in the window and add notes"
-- instead of a chat round trip. Mirrors set_planner_learning_activity_status's
-- security shape (family_members lock, family-scoped row lock); direct
-- table writes stay revoked from authenticated per that migration's rule.

create or replace function public.update_planner_learning_activity_details(
  target_activity_id uuid,
  target_title text,
  target_note text
)
returns table (
  result text,
  activity_id uuid,
  family_id uuid,
  title text,
  note text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity public.planner_learning_activities%rowtype;
  observed_family_id uuid;
  locked_membership_family_id uuid;
  normalized_title text;
  normalized_note text;
begin
  if auth.uid() is null then
    raise exception 'update_planner_learning_activity_details requires an authenticated caller'
      using errcode = '42501';
  end if;

  normalized_title := btrim(target_title);
  normalized_note := nullif(btrim(coalesce(target_note, '')), '');
  if char_length(normalized_title) < 1 or char_length(normalized_title) > 300 then
    raise exception 'planner activity title is invalid' using errcode = '22023';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 500 then
    raise exception 'planner activity note is invalid' using errcode = '22023';
  end if;

  select row.family_id into observed_family_id
  from public.planner_learning_activities row
  where row.id = target_activity_id;

  select member.family_id into locked_membership_family_id
  from public.family_members member
  where member.family_id = observed_family_id
    and member.user_id = auth.uid()
  for key share;

  if locked_membership_family_id is null then
    raise exception 'planner activity does not belong to the caller'
      using errcode = '42501';
  end if;

  update public.planner_learning_activities as target
  set title = normalized_title,
      note = normalized_note,
      updated_at = now()
  where target.id = target_activity_id
    and target.family_id = locked_membership_family_id
  returning * into activity;

  if activity.id is null then
    raise exception 'planner activity changed before the edit could be saved'
      using errcode = '40001';
  end if;

  return query select
    'applied'::text, activity.id, activity.family_id,
    activity.title, activity.note, activity.updated_at;
end;
$$;

revoke all on function public.update_planner_learning_activity_details(uuid, text, text)
  from public, anon;
grant execute on function public.update_planner_learning_activity_details(uuid, text, text)
  to authenticated;
