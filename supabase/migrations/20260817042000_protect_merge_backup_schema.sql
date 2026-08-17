-- Contain the production-only July 11 merge backup until its retention
-- decision is made. The schema is absent from fresh databases, so this
-- migration intentionally becomes a no-op there.
do $$
declare
  backup_table record;
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'merge_backup_20260711'
  ) then
    execute 'revoke all privileges on schema merge_backup_20260711 from anon, authenticated';

    for backup_table in
      select schemaname, tablename
      from pg_tables
      where schemaname = 'merge_backup_20260711'
    loop
      execute format(
        'revoke all privileges on table %I.%I from anon, authenticated',
        backup_table.schemaname,
        backup_table.tablename
      );
      execute format(
        'alter table %I.%I enable row level security',
        backup_table.schemaname,
        backup_table.tablename
      );
    end loop;
  end if;
end
$$;
