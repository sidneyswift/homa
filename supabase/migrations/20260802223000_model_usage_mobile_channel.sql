-- Native requests are a first-class model-usage channel. This expands the
-- existing closed set so mobile calls are not mislabeled as web traffic.
alter table public.model_usage
  drop constraint if exists model_usage_channel_check;

alter table public.model_usage
  add constraint model_usage_channel_check
  check (channel in ('web', 'sms', 'email', 'dispatch', 'mobile', 'subject_lesson'));
