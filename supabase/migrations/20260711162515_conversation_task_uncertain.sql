-- Family task status preserves an unknown provider outcome instead of
-- presenting it as a confirmed failure.

alter table public.homa_task_runs
  drop constraint if exists homa_task_runs_status_check;
alter table public.homa_task_runs
  add constraint homa_task_runs_status_check
  check (
    status in (
      'running', 'done', 'partial', 'partial_uncertain',
      'uncertain', 'failed', 'skipped'
    )
  );
