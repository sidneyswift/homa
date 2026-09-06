-- Additive metadata: historical sitting outcomes keep their unknown cause/count.
alter table public.progress_check_ins
  add column terminal_reason text check (terminal_reason in (
    'sitting_limit', 'bank_coverage_end', 'no_useful_question', 'parent_stopped'
  )),
  add column terminal_mixed_evidence boolean,
  add column accepted_response_count integer check (accepted_response_count >= 0),
  add column uncertain_response_count integer check (
    uncertain_response_count >= 0 and uncertain_response_count <= accepted_response_count
  );

comment on column public.progress_check_ins.terminal_reason is
  'Exact workflow stop reason, not a score or confidence claim. Null for legacy outcomes.';

-- A selected web action has one durable outcome, including no question.
-- Acceptance does not claim that an assistant message was delivered.
create table public.progress_check_in_start_requests (
  family_id uuid not null references public.families(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  child_id uuid not null,
  subject_id text not null check (length(subject_id) between 1 and 80),
  runtime_session_id text not null check (length(runtime_session_id) between 1 and 256),
  turn_id text not null check (length(turn_id) between 1 and 256),
  result jsonb,
  issued_check_in_id uuid,
  issued_revision integer check (issued_revision > 0),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (family_id, member_user_id, request_id),
  foreign key (child_id, family_id) references public.children(id, family_id) on update cascade on delete cascade,
  foreign key (issued_check_in_id, child_id, family_id) references public.progress_check_ins(id, child_id, family_id) on update cascade on delete cascade,
  check ((issued_check_in_id is null) = (issued_revision is null)),
  check (delivered_at is null or issued_check_in_id is not null),
  check ((result is null) = (accepted_at is null))
);

alter table public.progress_check_in_start_requests enable row level security;
create policy "adult reads own selected progress actions"
  on public.progress_check_in_start_requests for select to authenticated
  using (member_user_id = auth.uid() and family_id in (
    select family_id from public.family_members where user_id = auth.uid()
  ));
revoke all on public.progress_check_in_start_requests from anon, authenticated;
grant select on public.progress_check_in_start_requests to authenticated;
