import { sendBandReadyEmail, sendReminderEmail } from "../../../../lib/map/email";
import { emitMapEvent } from "../../../../lib/map/events";
import {
  childrenNowInBand,
  leadsNeedingReminder,
  markBandReady,
  markReminderSent,
  rotateResumeToken,
} from "../../../../lib/map/store";

/**
 * GET /api/map/cron  (Vercel cron, hourly)
 * Two promise-keeping jobs in one pass:
 *   1. The single 24h reminder for parked flows (one send ever, never a
 *      sequence: reminder_sent_at is checked and stamped).
 *   2. The band-ready promise: children captured outside the scored range
 *      get their checklist email automatically the moment their band ships,
 *      with no one having to remember.
 * Gated by CRON_SECRET so only Vercel's scheduler can trigger sends.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let reminders = 0;
  let bandReady = 0;

  try {
    for (const lead of await leadsNeedingReminder()) {
      const token = await rotateResumeToken(lead.id);
      const sent = await sendReminderEmail(lead.email, lead.first_child, token);
      if (sent) {
        await markReminderSent(lead.id);
        await emitMapEvent("map.reminder_sent", { lead_id: lead.id });
        reminders += 1;
      }
    }

    for (const child of await childrenNowInBand()) {
      const token = await rotateResumeToken(child.lead_id);
      const sent = await sendBandReadyEmail(child.email, child.child_name, token);
      if (sent) {
        await markBandReady(child.child_id);
        await emitMapEvent("map.band_ready_emailed", {
          lead_id: child.lead_id,
          child_id: child.child_id,
        });
        bandReady += 1;
      }
    }
  } catch (error) {
    console.error("map/cron failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, reminders, bandReady }, { status: 500 });
  }

  return Response.json({ ok: true, reminders, bandReady });
}
