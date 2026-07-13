import { adminDb } from "./db";

/**
 * The session inspector's data (deep view direction 2): every agent run
 * across the fleet, and one session's full trace. A "session" is the
 * union of two sources, because a run that died before eve started
 * (e.g. the 2026-07-12 HookConflictError pair) has a homa_task_runs row
 * but zero conversation_messages, and the inspector exists precisely to
 * show those:
 *
 *   - conversation_messages grouped by session_id (chat on any channel),
 *   - homa_task_runs (proactive work), merged by session_id.
 *
 * Sequential queries, ::text casts, json aggregates as text (db.ts laws).
 */

export interface SessionListRow {
  /** Session id, or `run:<id>` for a run that never got a session. */
  key: string;
  sessionId: string | null;
  familyId: string | null;
  familyName: string | null;
  channels: string[];
  startedAt: string;
  endedAt: string;
  messageCount: number;
  userMessageCount: number;
  toolCallCount: number;
  tokensIn: number;
  tokensOut: number;
  run: {
    id: string;
    kind: string;
    title: string;
    status: string;
    error: string | null;
  } | null;
}

export interface SessionListFilters {
  channel?: string | null;
  familyId?: string | null;
  failedOnly?: boolean;
  limit?: number;
}

interface GroupedSessionRow {
  session_id: string;
  family_id: string | null;
  family_name: string | null;
  started_at: string;
  ended_at: string;
  message_count: number;
  user_message_count: number;
  channels: string;
}

interface RunRow {
  id: string;
  session_id: string | null;
  family_id: string | null;
  family_name: string | null;
  kind: string;
  title: string;
  status: string;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export async function listSessions(
  filters: SessionListFilters = {},
): Promise<SessionListRow[]> {
  const sql = adminDb();
  const limit = Math.min(filters.limit ?? 60, 200);
  const channel = filters.channel ?? null;
  const familyId = filters.familyId ?? null;

  const grouped = await sql<GroupedSessionRow[]>`
    select m.session_id, m.family_id, f.name as family_name,
           min(m.created_at)::text as started_at,
           max(m.created_at)::text as ended_at,
           count(*)::int as message_count,
           count(*) filter (where m.role = 'user')::int as user_message_count,
           json_agg(distinct m.channel)::text as channels
    from public.conversation_messages m
    left join public.families f on f.id = m.family_id
    where (${familyId === null} or m.family_id = ${familyId})
    group by m.session_id, m.family_id, f.name
    having (${channel === null} or bool_or(m.channel = ${channel ?? ""}))
    order by max(m.created_at) desc
    limit ${limit}
  `;

  const runs = await sql<RunRow[]>`
    select r.id, r.session_id, r.family_id, f.name as family_name,
           r.kind, r.title, r.status, r.error,
           r.started_at::text as started_at,
           r.finished_at::text as finished_at
    from public.homa_task_runs r
    left join public.families f on f.id = r.family_id
    where (${familyId === null} or r.family_id = ${familyId})
      and (${!filters.failedOnly} or r.status in ('failed', 'uncertain', 'partial_uncertain'))
    order by r.started_at desc
    limit ${limit}
  `;

  // Id lists travel as one comma-joined text parameter, split by
  // string_to_array server-side: adminDb runs with fetch_types off, so
  // sql.array() and json parameters both mis-serialize (db.ts posture);
  // session ids and uuids never contain commas.
  const sessionIds = grouped.map((row) => row.session_id).join(",");
  const usageBySession = new Map<string, { tokensIn: number; tokensOut: number }>();
  const toolsBySession = new Map<string, number>();
  if (grouped.length > 0) {
    const usage = await sql<
      { session_id: string; tokens_in: number; tokens_out: number }[]
    >`
      select session_id,
             coalesce(sum(input_tokens), 0)::int as tokens_in,
             coalesce(sum(output_tokens), 0)::int as tokens_out
      from public.model_usage
      where session_id in (select unnest(string_to_array(${sessionIds}, ',')))
      group by session_id
    `;
    for (const row of usage) {
      usageBySession.set(row.session_id, {
        tokensIn: row.tokens_in,
        tokensOut: row.tokens_out,
      });
    }
    const tools = await sql<{ session_id: string; n: number }[]>`
      select session_id, count(*)::int as n
      from public.agent_tool_calls
      where session_id in (select unnest(string_to_array(${sessionIds}, ',')))
      group by session_id
    `;
    for (const row of tools) toolsBySession.set(row.session_id, row.n);
  }

  const runsBySession = new Map<string, RunRow>();
  const sessionlessRuns: RunRow[] = [];
  for (const run of runs) {
    if (run.session_id) runsBySession.set(run.session_id, run);
    else sessionlessRuns.push(run);
  }

  const rows: SessionListRow[] = grouped.map((row) => {
    const run = runsBySession.get(row.session_id) ?? null;
    const usage = usageBySession.get(row.session_id);
    let channels: string[] = [];
    try {
      channels = JSON.parse(row.channels) as string[];
    } catch {
      channels = [];
    }
    return {
      key: row.session_id,
      sessionId: row.session_id,
      familyId: row.family_id,
      familyName: row.family_name,
      channels,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      messageCount: row.message_count,
      userMessageCount: row.user_message_count,
      toolCallCount: toolsBySession.get(row.session_id) ?? 0,
      tokensIn: usage?.tokensIn ?? 0,
      tokensOut: usage?.tokensOut ?? 0,
      run: run
        ? { id: run.id, kind: run.kind, title: run.title, status: run.status, error: run.error }
        : null,
    };
  });

  // Runs whose session never wrote a message (or never started) get
  // their own rows; that failure mode must never be invisible here.
  const seenSessionIds = new Set(rows.map((row) => row.sessionId));
  for (const run of runs) {
    if (run.session_id && seenSessionIds.has(run.session_id)) continue;
    if (channel !== null && channel !== "dispatch") continue;
    rows.push({
      key: run.session_id ?? `run:${run.id}`,
      sessionId: run.session_id,
      familyId: run.family_id,
      familyName: run.family_name,
      channels: ["dispatch"],
      startedAt: run.started_at,
      endedAt: run.finished_at ?? run.started_at,
      messageCount: 0,
      userMessageCount: 0,
      toolCallCount: run.session_id ? toolsBySession.get(run.session_id) ?? 0 : 0,
      tokensIn: 0,
      tokensOut: 0,
      run: { id: run.id, kind: run.kind, title: run.title, status: run.status, error: run.error },
    });
  }

  const failedFiltered = filters.failedOnly
    ? rows.filter((row) => row.run && ["failed", "uncertain", "partial_uncertain"].includes(row.run.status))
    : rows;

  return failedFiltered
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(0, limit);
}

export interface SessionTraceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  channel: string;
  visibility: string;
  memberName: string | null;
  turnId: string | null;
  sequence: number;
  createdAt: string;
}

export interface SessionToolCall {
  id: string;
  tool: string;
  args: unknown;
  result: unknown;
  status: string;
  isError: boolean | null;
  turnId: string | null;
  stepIndex: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface SessionSnapshot {
  content: string;
  channel: string | null;
  turnId: string | null;
  createdAt: string;
}

export interface SessionUsageLine {
  surface: string;
  model: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
}

export interface SessionDetail {
  sessionId: string;
  familyId: string | null;
  familyName: string | null;
  messages: SessionTraceMessage[];
  toolCalls: SessionToolCall[];
  snapshots: SessionSnapshot[];
  usage: SessionUsageLine[];
  run: {
    id: string;
    kind: string;
    title: string;
    status: string;
    error: string | null;
    summary: string | null;
    deliveredChannel: string | null;
    scheduledFor: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  deliveries: {
    channel: string;
    status: string;
    error: string | null;
    createdAt: string;
    repliedAt: string | null;
  }[];
}

function parseJsonText(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const sql = adminDb();

  const messages = await sql<
    {
      id: string;
      role: "user" | "assistant";
      content: string;
      channel: string;
      visibility: string;
      member_name: string | null;
      turn_id: string | null;
      sequence: number;
      family_id: string | null;
      created_at: string;
    }[]
  >`
    select m.id, m.role, m.content, m.channel, m.visibility,
           coalesce(fm.display_name, u.email) as member_name,
           m.turn_id, m.sequence, m.family_id,
           m.created_at::text as created_at
    from public.conversation_messages m
    left join public.family_members fm
      on fm.user_id = m.member_user_id and fm.family_id = m.family_id
    left join auth.users u on u.id = m.member_user_id
    where m.session_id = ${sessionId}
    order by m.created_at asc, m.sequence asc
  `;

  const runRows = await sql<
    {
      id: string;
      family_id: string | null;
      kind: string;
      title: string;
      status: string;
      error: string | null;
      summary: string | null;
      delivered_channel: string | null;
      scheduled_for: string | null;
      started_at: string;
      finished_at: string | null;
    }[]
  >`
    select id, family_id, kind, title, status, error, summary,
           delivered_channel, scheduled_for::text as scheduled_for,
           started_at::text as started_at, finished_at::text as finished_at
    from public.homa_task_runs
    where session_id = ${sessionId}
    limit 1
  `;
  const run = runRows[0] ?? null;

  const familyId = messages[0]?.family_id ?? run?.family_id ?? null;
  if (messages.length === 0 && !run) return null;

  let familyName: string | null = null;
  if (familyId) {
    const familyRows = await sql<{ name: string }[]>`
      select name from public.families where id = ${familyId}
    `;
    familyName = familyRows[0]?.name ?? null;
  }

  const toolCalls = await sql<
    {
      id: string;
      tool: string;
      args: string | null;
      result: string | null;
      status: string;
      is_error: boolean | null;
      turn_id: string | null;
      step_index: number | null;
      created_at: string;
      finished_at: string | null;
    }[]
  >`
    select id, tool, args::text as args, result::text as result, status,
           is_error, turn_id, step_index,
           created_at::text as created_at, finished_at::text as finished_at
    from public.agent_tool_calls
    where session_id = ${sessionId}
    order by created_at asc
  `;

  const snapshots = await sql<
    { content: string; channel: string | null; turn_id: string | null; created_at: string }[]
  >`
    select content, channel, turn_id, created_at::text as created_at
    from public.session_context_snapshots
    where session_id = ${sessionId}
    order by created_at asc
  `;

  const usage = await sql<
    { surface: string; model: string; calls: number; tokens_in: number; tokens_out: number }[]
  >`
    select surface, model, count(*)::int as calls,
           coalesce(sum(input_tokens), 0)::int as tokens_in,
           coalesce(sum(output_tokens), 0)::int as tokens_out
    from public.model_usage
    where session_id = ${sessionId}
    group by surface, model
    order by tokens_in desc
  `;

  const deliveries = run
    ? await sql<
        {
          channel: string;
          status: string;
          error: string | null;
          created_at: string;
          replied_at: string | null;
        }[]
      >`
        select channel, status, error, created_at::text as created_at,
               replied_at::text as replied_at
        from public.conversation_deliveries
        where task_run_id = ${run.id}
        order by created_at asc
      `
    : [];

  return {
    sessionId,
    familyId,
    familyName,
    messages: messages.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      channel: row.channel,
      visibility: row.visibility,
      memberName: row.member_name,
      turnId: row.turn_id,
      sequence: row.sequence,
      createdAt: row.created_at,
    })),
    toolCalls: toolCalls.map((row) => ({
      id: row.id,
      tool: row.tool,
      args: parseJsonText(row.args),
      result: parseJsonText(row.result),
      status: row.status,
      isError: row.is_error,
      turnId: row.turn_id,
      stepIndex: row.step_index,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    })),
    snapshots: snapshots.map((row) => ({
      content: row.content,
      channel: row.channel,
      turnId: row.turn_id,
      createdAt: row.created_at,
    })),
    usage: usage.map((row) => ({
      surface: row.surface,
      model: row.model,
      calls: row.calls,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
    })),
    run: run
      ? {
          id: run.id,
          kind: run.kind,
          title: run.title,
          status: run.status,
          error: run.error,
          summary: run.summary,
          deliveredChannel: run.delivered_channel,
          scheduledFor: run.scheduled_for,
          startedAt: run.started_at,
          finishedAt: run.finished_at,
        }
      : null,
    deliveries: deliveries.map((row) => ({
      channel: row.channel,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      repliedAt: row.replied_at,
    })),
  };
}
