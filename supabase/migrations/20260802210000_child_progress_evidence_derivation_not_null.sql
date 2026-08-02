-- Contract after provenance-aware writers are deployed. The default
-- remains as a compatibility guard for older direct SQL writers.
update public.child_progress_evidence
set derivation = 'unknown'
where derivation is null;

alter table public.child_progress_evidence
  alter column derivation set not null;
