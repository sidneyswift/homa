-- Give every legacy Eve session a canonical episode without guessing
-- cross-session causality or adult identity that the old schema never stored.

do $$
declare
  legacy record;
  new_episode_id uuid;
begin
  for legacy in
    select family_id, session_id, min(created_at) as opened_at,
           max(created_at) as last_activity_at
    from public.conversation_messages
    where episode_id is null
    group by family_id, session_id
  loop
    insert into public.conversation_episodes
      (family_id, scope, status, opened_at, last_activity_at, closed_at)
    values
      (legacy.family_id, 'household',
       case when legacy.last_activity_at < now() - interval '2 hours'
            then 'closed' else 'open' end,
       legacy.opened_at, legacy.last_activity_at,
       case when legacy.last_activity_at < now() - interval '2 hours'
            then legacy.last_activity_at else null end)
    returning id into new_episode_id;

    update public.conversation_messages
    set episode_id = new_episode_id
    where family_id = legacy.family_id
      and session_id = legacy.session_id
      and episode_id is null;
  end loop;
end
$$;

-- A task run's generated assistant text is unique within its family/day.
-- Restore the links the old dispatcher did not persist. This does not invent
-- recipient delivery rows.
update public.conversation_messages message
set task_run_id = run.id
from public.homa_task_runs run
where message.family_id = run.family_id
  and message.channel = 'dispatch'
  and message.role = 'assistant'
  and run.summary is not null
  and message.content = run.summary
  and message.created_at between run.started_at - interval '5 minutes'
                             and coalesce(run.finished_at + interval '5 minutes',
                                          run.started_at + interval '2 hours')
  and message.task_run_id is null;

update public.homa_task_runs run
set session_id = message.session_id
from public.conversation_messages message
where message.task_run_id = run.id
  and run.session_id is null;
