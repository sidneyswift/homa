-- Disposable, server-only fixture schema for gh#1171. Never a production rollout migration.
create schema homa_fg_1171_20260914;
comment on schema homa_fg_1171_20260914 is 'gh1171 foreground preview 20260914 owned experiment';
revoke all on schema homa_fg_1171_20260914 from public, anon, authenticated;
create table homa_fg_1171_20260914.sessions (
 id uuid primary key,
 family_id uuid not null references public.families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(id,family_id,user_id)
);
create table homa_fg_1171_20260914.turns (
 id uuid primary key,
 session_id uuid not null,
 family_id uuid not null,
 user_id uuid not null,
 prompt text not null check(length(prompt) between 1 and 2000),
 status text not null check(status in ('accepted','running','completed','cancelled','failed','interrupted')),
 lease_id uuid not null,
 answer text not null default '' check(length(answer)<=7000),
 event_sequence integer not null default 0,
 error text,
 created_at timestamptz not null default now(),
 heartbeat_at timestamptz not null default now(),
 finished_at timestamptz,
 projected_at timestamptz,
 foreign key(session_id,family_id,user_id) references homa_fg_1171_20260914.sessions(id,family_id,user_id) on delete cascade
);
create unique index one_active_turn_per_session on homa_fg_1171_20260914.turns(session_id) where status in ('accepted','running');
create table homa_fg_1171_20260914.events (
 turn_id uuid not null references homa_fg_1171_20260914.turns(id) on delete cascade,
 sequence integer not null,
 event jsonb not null,
 created_at timestamptz not null default now(),
 primary key(turn_id,sequence)
);
alter table homa_fg_1171_20260914.sessions enable row level security;
alter table homa_fg_1171_20260914.turns enable row level security;
alter table homa_fg_1171_20260914.events enable row level security;
revoke all on all tables in schema homa_fg_1171_20260914 from public, anon, authenticated;
