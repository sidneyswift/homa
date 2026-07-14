-- Research run control: one durable owner per research topic.
--
-- Scheduled backfills, manual runs, and condensed labs all enter through
-- the same runner. A partial unique index on the active cell key is the
-- cross-process lock: two triggers may race, but only one can own the
-- running row and spend model/search budget. The application keys this
-- topic-wide (across lens/stage) because prior-source dedup has the same
-- scope. Completed and failed runs
-- fall out of the index, so a later refresh of the cell remains possible.
--
-- Additive only. Existing fleet runs keep null metadata and current RLS
-- policies remain unchanged (homa_task_runs is server-write-only).

alter table public.homa_task_runs
  add column if not exists research_cell_key text
    check (
      research_cell_key is null
      or char_length(research_cell_key) between 3 and 160
    ),
  add column if not exists research_trigger text
    check (
      research_trigger is null
      or research_trigger in ('scheduled', 'manual', 'lab')
    );

create unique index if not exists homa_task_runs_running_research_cell_idx
  on public.homa_task_runs (research_cell_key)
  where kind = 'fleet_research'
    and status = 'running'
    and research_cell_key is not null;

create index if not exists homa_task_runs_research_trigger_idx
  on public.homa_task_runs (research_trigger, started_at desc)
  where kind = 'fleet_research';
