import { recordHoursPinned } from "../../../../../lib/agent-pinned";
import { mapDb } from "../../../../../lib/map/db";
import { rateLimited } from "../../../../../lib/map/ratelimit";

/**
 * POST /api/voice/tools/log-hours: the voice assistants' capture-time
 * hours tool (M3-05 slice). A phone call is a capture moment too: "we
 * did about an hour of reading this morning" becomes a compliance row
 * while the assistant can still ask "about how long?". Same templated
 * keyed-URL posture as send-email and remember: the model supplies only
 * the block itself, never whose record it lands in. The write itself
 * goes through the shared pinned path (lib/agent-pinned.ts), the same
 * guards the SMS tool path uses.
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
  if (rateLimited(`voice-hours:${familyId}`, MAX_PER_FAMILY_PER_DAY, DAY_MS)) {
    return Response.json({
      success: false,
      error: "Enough hours logged from calls today. Tell the parent the rest can be added in chat.",
    });
  }

  // The templated child_id is only trusted after it resolves inside THIS
  // family; recordHoursPinned re-checks, but a bad id should fall back to
  // the model-supplied name rather than hard-fail the call.
  let childId: string | null = null;
  if (childIdParam) {
    const sql = mapDb();
    const rows = await sql<{ id: string }[]>`
      select id from public.children where id = ${childIdParam} and family_id = ${familyId}
    `;
    childId = rows[0]?.id ?? null;
  }

  const result = await recordHoursPinned({
    familyId,
    minutes: Math.round(Number(body.minutes)),
    subject: (body.subject ?? "").trim(),
    source: "call",
    childId,
    childName: body.child_name ?? null,
    note: body.note ?? null,
  });

  if (!result.logged) {
    return Response.json({ success: false, error: result.note });
  }
  return Response.json({
    success: true,
    note: "On the record. Confirm to the parent in one short natural aside.",
  });
}
