import { createHash } from "node:crypto";

import { mapDb } from "../map/db";

/**
 * The agent's flight recorder (founder deep view, 2026-07-13): durable,
 * best-effort capture of what a session actually did, feeding the
 * founder console's session inspector. Three writers, one law shared
 * with recordModelUsage: telemetry never breaks the feature emitting
 * it, so every function here swallows its own failures.
 *
 *   - tool calls: agent/hooks/record-tool-calls.ts pairs eve's
 *     actions.requested and action.result stream events by callId.
 *   - context snapshots: agent/instructions/family-context.ts records
 *     the dynamic blocks it assembled, deduped per session by content
 *     hash so identical turns cost one row, not one per turn.
 *
 * familyId always arrives from session auth attributes (the channel
 * stamped it), never from model output.
 */

/** Keep any single captured string readable without letting a 100KB
 * material HTML ride along; the html itself already lives on the
 * materials row. */
const MAX_CAPTURED_STRING = 2000;
const MAX_ARGS_JSON = 24000;
const MAX_RESULT_JSON = 8000;
const MAX_SNAPSHOT_CHARS = 60000;

/** Deep-copies a JSON value with every long string truncated, so args
 * capture stays informative but bounded. */
export function sanitizeCapturedJson(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") {
    return value.length > MAX_CAPTURED_STRING
      ? `${value.slice(0, MAX_CAPTURED_STRING)}... [truncated ${value.length} chars]`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 6) return "[depth capped]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitizeCapturedJson(entry, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeCapturedJson(entry, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** The sanitized value, or a stringified preview when even the
 * sanitized JSON overruns the byte budget. */
export function boundedCapturedJson(value: unknown, maxJsonChars: number): unknown {
  const sanitized = sanitizeCapturedJson(value);
  try {
    const text = JSON.stringify(sanitized);
    if (text && text.length > maxJsonChars) {
      return { truncated: true, preview: text.slice(0, maxJsonChars) };
    }
  } catch {
    return { truncated: true, preview: String(value).slice(0, maxJsonChars) };
  }
  return sanitized;
}

export interface ToolCallRequested {
  familyId: string | null;
  sessionId: string;
  turnId: string | null;
  stepIndex: number | null;
  callId: string;
  channel: string | null;
  tool: string;
  args: unknown;
}

export async function recordToolCallRequested(input: ToolCallRequested): Promise<void> {
  try {
    const sql = mapDb();
    const args = boundedCapturedJson(input.args, MAX_ARGS_JSON);
    await sql`
      insert into public.agent_tool_calls
        (family_id, session_id, turn_id, step_index, call_id, channel, tool, args)
      values
        (${input.familyId}, ${input.sessionId}, ${input.turnId},
         ${input.stepIndex}, ${input.callId}, ${input.channel}, ${input.tool},
         ${sql.json(args as never)})
      on conflict (session_id, call_id) do nothing
    `;
  } catch (error) {
    console.error(
      "recordToolCallRequested failed (feature unaffected):",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export interface ToolCallResult {
  sessionId: string;
  callId: string;
  status: "completed" | "failed" | "rejected";
  isError: boolean | null;
  result: unknown;
}

export async function recordToolCallResult(input: ToolCallResult): Promise<void> {
  try {
    const sql = mapDb();
    const result = boundedCapturedJson(input.result, MAX_RESULT_JSON);
    await sql`
      update public.agent_tool_calls
      set status = ${input.status},
          is_error = ${input.isError},
          result = ${sql.json(result as never)},
          finished_at = now()
      where session_id = ${input.sessionId} and call_id = ${input.callId}
    `;
  } catch (error) {
    console.error(
      "recordToolCallResult failed (feature unaffected):",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export interface StuckToolCall {
  tool: string;
  channel: string | null;
  sessions: number;
  calls: number;
  oldestMinutes: number;
}

/**
 * The longest deadline any tool may declare (TOOL_DEADLINE.generate,
 * lib/agent-tool-deadline.ts), plus room for the turn to record the
 * result. A call still open past this did not merely run long: either the
 * deadline never fired because the process died mid-call, or something
 * reached the model without going through defineBoundedTool. Both are
 * worth a look, and neither is normal traffic.
 */
const STUCK_AFTER_MINUTES = 15;

/**
 * How far back the sweep looks. A stuck row never resolves: its status
 * stays 'requested' and finished_at stays null for as long as the row
 * exists. Without this bound the seven rows from the 07-19 and 07-22
 * incidents would be reported every hour forever, and an alarm that never
 * clears is worse than no alarm, because it teaches the reader to skip
 * the line that finally matters.
 *
 * The cron runs hourly, so a genuinely new stuck call still gets roughly
 * two dozen chances to be seen before it ages out of the window. Use
 * findStuckToolCalls with an explicit window to go looking at history on
 * purpose; the recurring signal stays about what is happening now.
 */
const STUCK_WINDOW_HOURS = 24;

/**
 * Tool calls that were requested and never finished (MJ-08 gap found
 * 2026-07-23): before this, the only thing that noticed a frozen turn was
 * the 2h task-run reaper, and it could only report the run as producing
 * no output, never why. Grouped by tool and channel, counts only, so the
 * line an operator reads carries no family content.
 *
 * Best effort like the writers above: a failure here returns nothing
 * rather than breaking the sweep that called it.
 */
export async function findStuckToolCalls(
  olderThanMinutes = STUCK_AFTER_MINUTES,
  windowHours = STUCK_WINDOW_HOURS,
): Promise<StuckToolCall[]> {
  try {
    const sql = mapDb();
    const rows = await sql<
      {
        tool: string;
        channel: string | null;
        sessions: string;
        calls: string;
        oldest_minutes: string;
      }[]
    >`
      select tool,
             channel,
             count(distinct session_id)::text as sessions,
             count(*)::text as calls,
             round(
               extract(epoch from (now() - min(created_at))) / 60
             )::text as oldest_minutes
      from public.agent_tool_calls
      where status = 'requested'
        and finished_at is null
        and created_at < now() - make_interval(mins => ${olderThanMinutes})
        and created_at > now() - make_interval(hours => ${windowHours})
      group by tool, channel
      order by count(*) desc
      limit 20
    `;
    return rows.map((row) => ({
      tool: row.tool,
      channel: row.channel,
      sessions: Number(row.sessions),
      calls: Number(row.calls),
      oldestMinutes: Number(row.oldest_minutes),
    }));
  } catch (error) {
    console.error(
      "findStuckToolCalls failed (sweep unaffected):",
      error instanceof Error ? error.message : "unknown",
    );
    return [];
  }
}

/** One operator line, built from enums and counts only. Tool and channel
 * names are ours; no family id, no session id, no parent content. */
export function stuckToolCallLine(row: StuckToolCall): string {
  return (
    `[agent_tool_calls] stuck tool=${row.tool} channel=${row.channel ?? "unknown"} ` +
    `calls=${row.calls} sessions=${row.sessions} oldest_minutes=${row.oldestMinutes}`
  );
}

/**
 * One line per stuck tool, plus the total for the cron's counts. Returns
 * the number of stuck calls so cron_runs records it and a quiet hour
 * looks different from an unrecorded one.
 */
export async function reportStuckToolCalls(): Promise<number> {
  const stuck = await findStuckToolCalls();
  for (const row of stuck) console.error(stuckToolCallLine(row));
  return stuck.reduce((total, row) => total + row.calls, 0);
}

export interface ContextSnapshot {
  familyId: string | null;
  sessionId: string;
  turnId: string | null;
  channel: string | null;
  content: string;
}

/** One row per distinct assembled context per session: the insert
 * dedupes on (session_id, content_hash), so a stable context across a
 * long session costs one row and a mid-session change (new memory, new
 * episode summary) writes exactly one more. */
export async function recordContextSnapshot(input: ContextSnapshot): Promise<void> {
  try {
    if (input.content.length === 0) return;
    const content =
      input.content.length > MAX_SNAPSHOT_CHARS
        ? `${input.content.slice(0, MAX_SNAPSHOT_CHARS - 20)}\n... [truncated]`
        : input.content;
    const hash = createHash("sha256").update(content).digest("hex");
    const sql = mapDb();
    await sql`
      insert into public.session_context_snapshots
        (family_id, session_id, turn_id, channel, content, content_hash)
      values
        (${input.familyId}, ${input.sessionId}, ${input.turnId},
         ${input.channel}, ${content}, ${hash})
      on conflict (session_id, content_hash) do nothing
    `;
  } catch (error) {
    console.error(
      "recordContextSnapshot failed (feature unaffected):",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
