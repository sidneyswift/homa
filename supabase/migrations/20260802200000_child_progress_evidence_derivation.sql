-- Preserve whether a Progress answer was shared directly, inferred by
-- Homa's validated claim pipeline, or written before derivation was saved.
-- Existing evidence cannot be reconstructed truthfully from its source.
alter table public.child_progress_evidence
  add column derivation text default 'unknown';

alter table public.child_progress_evidence
  add constraint child_progress_evidence_derivation_check
  check (derivation in ('direct', 'inferred', 'unknown'));

comment on column public.child_progress_evidence.derivation is
  'How the answer was identified: direct parent input, validated inference, or unknown historical provenance.';

-- The reconciliation path is a second ledger writer. Historical
-- child_answers rows carry no derivation signal, so it writes unknown
-- explicitly instead of guessing from the answer source.
create or replace function private.reconcile_child_answers_to_progress()
returns table(inserted_count bigint, superseded_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconciliation_at timestamptz := clock_timestamp();
  inserted_rows bigint := 0;
  superseded_rows bigint := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    private.child_progress_reconciliation_lock_key()
  );
  lock table public.child_answers in share row exclusive mode;

  insert into public.child_progress_evidence (
    child_id,
    family_id,
    item_id,
    answer,
    derivation,
    source,
    supersedes_id,
    observed_at,
    idempotency_key,
    created_at
  )
  select
    answer.child_id,
    child.family_id,
    answer.question_id,
    answer.answer,
    'unknown',
    private.normalize_child_progress_source(answer.source),
    previous.id,
    answer.answered_at,
    'legacy-reconcile:' || md5(
      answer.child_id::text
        || '|' || answer.question_id
        || '|' || answer.answer
        || '|' || private.normalize_child_progress_source(answer.source)
        || '|' || extract(epoch from answer.answered_at)::text
    ),
    answer.answered_at
  from public.child_answers answer
  join public.children child on child.id = answer.child_id
  left join lateral (
    select evidence.id
    from public.child_progress_evidence evidence
    where evidence.child_id = answer.child_id
      and evidence.family_id = child.family_id
      and evidence.item_id = answer.question_id
      and evidence.superseded_at is null
      and (
        evidence.idempotency_key like 'legacy:%'
        or evidence.idempotency_key like 'legacy-reconcile:%'
      )
    order by evidence.observed_at desc, evidence.created_at desc,
             evidence.id desc
    limit 1
  ) previous on true
  where answer.answer in ('easily', 'getting_there', 'not_yet')
    and not exists (
      select 1
      from public.child_progress_evidence exact_evidence
      where exact_evidence.child_id = answer.child_id
        and exact_evidence.family_id = child.family_id
        and exact_evidence.item_id = answer.question_id
        and exact_evidence.answer = answer.answer
        and exact_evidence.source =
          private.normalize_child_progress_source(answer.source)
        and exact_evidence.observed_at = answer.answered_at
        and exact_evidence.superseded_at is null
    )
  on conflict (child_id, family_id, idempotency_key) do nothing;
  get diagnostics inserted_rows = row_count;

  update public.child_progress_evidence evidence
  set superseded_at = reconciliation_at
  where evidence.superseded_at is null
    and (
      evidence.idempotency_key like 'legacy:%'
      or evidence.idempotency_key like 'legacy-reconcile:%'
    )
    and not exists (
      select 1
      from public.child_progress_conflicts conflict
      where conflict.child_id = evidence.child_id
        and conflict.family_id = evidence.family_id
        and conflict.state = 'open'
        and evidence.id in (
          conflict.evidence_id_a,
          conflict.evidence_id_b
        )
    )
    and not exists (
      select 1
      from public.child_answers answer
      join public.children child on child.id = answer.child_id
      where answer.child_id = evidence.child_id
        and child.family_id = evidence.family_id
        and answer.question_id = evidence.item_id
        and answer.answer in ('easily', 'getting_there', 'not_yet')
        and answer.answer = evidence.answer
        and evidence.source =
          private.normalize_child_progress_source(answer.source)
        and evidence.observed_at = answer.answered_at
    );
  get diagnostics superseded_rows = row_count;

  return query select inserted_rows, superseded_rows;
end
$$;

revoke all on function private.reconcile_child_answers_to_progress()
  from public, anon, authenticated;
