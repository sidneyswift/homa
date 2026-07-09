import { mapDb } from "./map/db";
import { sendJournalPromptEmail } from "./map/email";
import { emitMapEvent } from "./map/events";

/**
 * The evening journal prompt (agentic ladder item 7; FR-6's daily on-ramp
 * for ambient capture). Homa's first proactive loop: at 8pm in each
 * family's own time zone, one short email invites one or two sentences
 * about the day, deep-linking into chat where the reply lands in front of
 * the agent (and the post-turn review turns it into memory).
 *
 * Dark by default: nothing sends unless JOURNAL_PROMPT_ENABLED=true (the
 * founder read-aloud gates the copy, then the flag flips). One send per
 * family per LOCAL day, stamped in families.journal_prompt_last_sent_at
 * and compared in the family's zone, so a zone change never double-sends.
 * Eligibility: a real account (email), a time zone on file, at least one
 * child. Families who joined today are skipped; day one already has the
 * report and the wow, the rhythm starts on day two.
 */

const PROMPT_LOCAL_HOUR = 20;

interface JournalCandidate {
  id: string;
  email: string;
  time_zone: string;
  first_name: string | null;
  parent_display_name: string | null;
  child_names: string[];
  journal_prompt_last_sent_at: string | null;
}

export function journalPromptEnabled(): boolean {
  return process.env.JOURNAL_PROMPT_ENABLED === "true";
}

/** Local hour (0-23) and local date key for a moment in a zone; returns
 * null for a zone Intl cannot resolve so one bad row never stops the loop. */
function localParts(zone: string, at: Date): { hour: number; dateKey: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const hour = Number(get("hour")) % 24;
    if (!Number.isFinite(hour)) return null;
    return { hour, dateKey: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    return null;
  }
}

export interface JournalPromptResult {
  candidates: number;
  sent: number;
  skipped: boolean;
}

export async function runJournalPromptPass(now = new Date()): Promise<JournalPromptResult> {
  if (!journalPromptEnabled()) return { candidates: 0, sent: 0, skipped: true };

  const sql = mapDb();
  const rows = await sql<JournalCandidate[]>`
    select f.id, f.email, f.time_zone, f.first_name, f.parent_display_name,
           f.journal_prompt_last_sent_at::text as journal_prompt_last_sent_at,
           coalesce(
             (select array_agg(c.name order by c.created_at)
              from public.children c where c.family_id = f.id),
             '{}'
           ) as child_names,
           f.created_at
    from public.families f
    where f.email is not null
      and f.time_zone is not null
      and f.created_at < now() - interval '20 hours'
      and exists (select 1 from public.children c where c.family_id = f.id)
      and (f.journal_prompt_last_sent_at is null
           or f.journal_prompt_last_sent_at < now() - interval '20 hours')
  `;

  let sent = 0;
  for (const family of rows) {
    const local = localParts(family.time_zone, now);
    if (!local || local.hour !== PROMPT_LOCAL_HOUR) continue;

    if (family.journal_prompt_last_sent_at) {
      const lastLocal = localParts(
        family.time_zone,
        new Date(family.journal_prompt_last_sent_at),
      );
      if (lastLocal && lastLocal.dateKey === local.dateKey) continue;
    }

    const firstName = family.parent_display_name ?? family.first_name;
    const ok = await sendJournalPromptEmail(family.email, firstName, family.child_names);
    if (!ok) continue;

    await sql`
      update public.families
      set journal_prompt_last_sent_at = now()
      where id = ${family.id}
    `;
    await emitMapEvent("journal.prompt_sent", { family_id: family.id });
    sent += 1;
  }

  return { candidates: rows.length, sent, skipped: false };
}
