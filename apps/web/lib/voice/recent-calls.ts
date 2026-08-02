import { mapDb } from "../map/db";

/**
 * The bounded "you two spoke recently" line for per-turn family context
 * (#171, work-order step 3).
 *
 * The problem it closes. A parent finished a phone call, opened web chat,
 * and Homa had never heard of it. The call-ended webhook
 * (/api/voice/insights) now puts the transcript in `call_transcripts`
 * within seconds, and `recall` finds it when Homa thinks to look. This line
 * is what makes her aware WITHOUT being asked, which is what the parent
 * actually experienced as amnesia: not a missing record, a Homa who did not
 * know they had just spoken.
 *
 * Per-adult by ruling, not by preference (`voice-transcript-per-adult`,
 * 2026-07-28). A call belongs to the adult who made it, the way their chats
 * do, so the query filters the owner persisted when the transcript lands.
 * Without a member id it returns nothing: failing closed on
 * a privacy rule is the only safe default, and the surface this fixes (web
 * chat) always has one.
 *
 * Bounded on purpose. This rides in EVERY turn's prompt, so it is a handful
 * of recent calls, one short line each, hard-capped in characters. It is a
 * nudge toward `recall`, never a transcript.
 */

/** Long enough to cover "we spoke yesterday", short enough that a call from
 * last week does not haunt every turn. */
const LOOKBACK_HOURS = 72;

/** More than this and it stops being a nudge. */
const MAX_CALLS = 3;

/** Per call, so three of them cannot crowd out the family block. */
const MAX_SUMMARY_CHARS = 180;

interface RecentCallRow {
  line: string;
  summary: string | null;
  transcript_text: string | null;
  started_at: string | null;
}

export interface RecentCallsInput {
  familyId: string;
  /** The authenticated adult. Null returns nothing, by ruling. */
  memberUserId: string | null;
  timeZone: string;
  sql?: ReturnType<typeof mapDb>;
}

/** Telnyx's own post-call summary when it exists, else the opening of the
 * transcript. Neither is trusted as fact: the line tells Homa a call
 * happened and roughly about what, and `recall` is where she reads it. */
export function callGist(row: RecentCallRow): string {
  const source = (row.summary ?? row.transcript_text ?? "").replace(/\s+/gu, " ").trim();
  if (source.length === 0) return "";
  return source.length <= MAX_SUMMARY_CHARS
    ? source
    : `${source.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`;
}

/** Exported for tests: the rendering, with no database in the way. */
export function renderRecentCalls(
  rows: readonly RecentCallRow[],
  timeZone: string,
): string {
  const lines = rows
    .map((row) => {
      const gist = callGist(row);
      const when = row.started_at
        ? new Date(row.started_at).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone,
          })
        : "recently";
      const where = row.line === "curriculum" ? "phone call about the report" : "phone call";
      return gist.length > 0 ? `- ${when}, ${where}: ${gist}` : `- ${when}, ${where}`;
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) return "";

  return [
    "## Calls you have already had with her",
    "",
    ...lines,
    "",
    "These already happened on the phone, they are not happening now. Mention"
      + " one only when it actually fits, the way you would remember a"
      + " conversation. Use recall to read what was said before relying on any"
      + " detail.",
  ].join("\n");
}

export async function loadRecentCallsContext(
  input: RecentCallsInput,
): Promise<string> {
  if (!input.memberUserId) return "";
  const sql = input.sql ?? mapDb();
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const rows = await sql<RecentCallRow[]>`
    select t.line, t.summary, t.transcript_text, t.started_at::text as started_at
    from public.call_transcripts t
    where t.family_id = ${input.familyId}
      and t.member_user_id = ${input.memberUserId}
      and t.started_at >= ${since}
    order by t.started_at desc
    limit ${MAX_CALLS}
  `;
  return renderRecentCalls(rows, input.timeZone);
}
