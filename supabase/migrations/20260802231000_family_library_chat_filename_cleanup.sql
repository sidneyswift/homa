-- Chat photo Blob paths carry Vercel's 27-character storage suffix. It is
-- not part of the filename the parent chose, so remove it from active Library
-- records that are proven to originate from a chat attachment. Preserve any
-- title that Homa or the parent already improved.
with candidates as (
  select
    id,
    original_name,
    regexp_replace(
      original_name,
      '-[A-Za-z0-9]{27}([.][^.]+)$',
      '\1'
    ) as cleaned_name
  from public.family_assets
  where source_attachment_id is not null
    and deleted_at is null
    and original_name ~ '-[A-Za-z0-9]{27}[.][^.]+$'
), cleaned as (
  select
    id,
    cleaned_name,
    regexp_replace(original_name, '[.][^.]{1,12}$', '') as default_title,
    regexp_replace(cleaned_name, '[.][^.]{1,12}$', '') as cleaned_title
  from candidates
)
update public.family_assets as asset
set
  original_name = cleaned.cleaned_name,
  title = case
    when asset.title = cleaned.default_title then cleaned.cleaned_title
    else asset.title
  end,
  updated_at = now()
from cleaned
where asset.id = cleaned.id;
