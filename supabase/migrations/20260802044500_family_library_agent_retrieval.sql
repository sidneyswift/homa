-- Family Library agent retrieval support (gh#577).
--
-- A chat attachment may be promoted more than once by a retrying agent turn,
-- but it must still produce exactly one family asset. Null remains allowed for
-- ordinary Library uploads, and the family component keeps the provenance
-- identity tenant-local.

create unique index if not exists family_assets_family_source_attachment_uidx
  on public.family_assets (family_id, source_attachment_id)
  where source_attachment_id is not null and deleted_at is null;
