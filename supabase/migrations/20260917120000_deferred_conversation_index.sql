-- Nullable marker is a durable queue and expiring worker lease. Existing readers
-- and writers remain compatible; no existing rows are backfilled.
alter table public.conversation_messages
  add column if not exists embedding_retry_at timestamptz;
create index if not exists conversation_messages_embedding_due_idx
  on public.conversation_messages (embedding_retry_at)
  where embedding_retry_at is not null;
comment on column public.conversation_messages.embedding_retry_at is
  'Server-owned semantic-index retry/lease timestamp; null means no work queued.';
