import { isHoursSubject } from "../../../../../lib/hours-model";
import { mapDb } from "../../../../../lib/map/db";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";

/**
 * POST /api/voice/tools/log-hours: the voice assistants' capture-time
 * hours tool (M3-05 slice). A phone call is a capture moment too: "we
 * did about an hour of reading this morning" becomes a compliance row
 * while the assistant can still ask "about how long?". Same templated
 * keyed-URL posture as send-email and remember: the model supplies only
 * the block itself, never whose record it lands in.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_FAMILY_PER_DAY = 30;

interface ToolCallBody {
  minutes?: number;
  subject?: string;
  child_name?: string;
  note?: string;
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  if (!secret || url.searchParams.get("key") !== secret) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const familyId = url.searchParams.get("family_id");
  const childIdParam = url.searchParams.get("child_id") || null;
  if (!familyId) {
    return Response.json({
      success: false,
      error: "This caller is not linked to a Homa family yet, so there is no record to add to.",
    });
  }

  let body: ToolCallBody;
  try {
    body = (await request.json()) as ToolCallBody;
  } catch {
    return Response.json({ success: false, error: "Missing minutes and subject." });
  }
  const minutes = Math.round(Number(body.minutes));
  const subject = (body.subject ?? "").trim();
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    return Response.json({
      success: false,
      error: "Minutes must be a number between 1 and 600. If the parent was vague, ask about how long it really was, then retry.",
    });
  }
  if (!isHoursSubject(subject)) {
    return Response.json({
      success: false,
      error: "That subject is not one of the record's subjects. Use one of: reading, math, science, social studies, art, music, PE, co-op, life skills, other.",
    });
  }
  if (rateLimited(`voice-hours:${familyId}`, MAX_PER_FAMILY_PER_DAY, DAY_MS)) {
    return Response.json({
      success: false,
      error: "Enough hours logged from calls today. Tell the parent the rest can be added in chat.",
    });
  }

  const sql = mapDb();

  // Child: prefer the templated id (curriculum line), else resolve the
  // model-supplied name inside THIS family only; unresolved means
  // family-wide, never a guess.
  let childId: string | null = null;
  if (childIdParam) {
    const rows = await sql<{ id: string }[]>`
      select id from public.children where id = ${childIdParam} and family_id = ${familyId}
    `;
    childId = rows[0]?.id ?? null;
  } else if (body.child_name?.trim()) {
    const rows = await sql<{ id: string }[]>`
      select id from public.children
      where family_id = ${familyId} and lower(name) = ${body.child_name.trim().toLowerCase()}
    `;
    childId = rows[0]?.id ?? null;
    if (!childId) {
      return Response.json({
        success: false,
        error: "That child name is not in this family. Use the name exactly as the family context shows it, or leave the child off for family-wide time.",
      });
    }
  }

  const note = body.note?.trim().slice(0, 200) || null;

  // Same double-log guard as the chat tool.
  const dupe = await sql<{ id: string }[]>`
    select id from public.hours_log
    where family_id = ${familyId}
      and subject = ${subject} and minutes = ${minutes}
      and happened_on = current_date
      and child_id is not distinct from ${childId}
    limit 1
  `;
  if (dupe[0]) {
    return Response.json({ success: true, note: "Already on the record for today; nothing added twice." });
  }

  await sql`
    insert into public.hours_log (family_id, child_id, subject, minutes, happened_on, source, note)
    values (${familyId}, ${childId}, ${subject}, ${minutes}, current_date, 'call', ${note})
  `;
  await emitMapEvent("voice.hours_logged", {
    family_id: familyId,
    ...(childId ? { child_id: childId } : {}),
    subject: subject,
    minutes,
  });

  return Response.json({
    success: true,
    note: "On the record. Confirm to the parent in one short natural aside.",
  });
}
