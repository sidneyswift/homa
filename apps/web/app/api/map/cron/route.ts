import { getMapDomain } from "@homa/core";

import { sendBandReadyEmail, sendReminderEmail, sendRetestEmail } from "../../../../lib/map/email";
import { emitMapEvent } from "../../../../lib/map/events";
import {
  childrenNowInBand,
  leadsNeedingReminder,
  markBandReady,
  markReminderSent,
  markRetestEmailed,
  plansNeedingRetest,
  mintLinkToken,
} from "../../../../lib/map/store";

/**
 * GET /api/map/cron  (Vercel cron, hourly)
 * Three promise-keeping jobs in one pass:
 *   1. The single 24h reminder for parked flows (one send ever, never a
 *      sequence: reminder_sent_at is checked and stamped).
 *   2. The band-ready promise: children captured outside the scored range
 *      get their checklist email automatically the moment their band ships.
 *   3. The retest loop: four weeks after a plan is built, one email invites
 *      the re-check that makes the numbers visibly move.
 * Gated by CRON_SECRET so only Vercel's scheduler can trigger sends.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let reminders = 0;
  let bandReady = 0;
  let retests = 0;

  try {
    for (const lead of await leadsNeedingReminder()) {
      const token = await mintLinkToken(lead.id);
      const sent = await sendReminderEmail(lead.email, lead.first_child, token);
      if (sent) {
        await markReminderSent(lead.id);
        await emitMapEvent("map.reminder_sent", { lead_id: lead.id });
        reminders += 1;
      }
    }

    for (const child of await childrenNowInBand()) {
      const token = await mintLinkToken(child.lead_id);
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

    for (const plan of await plansNeedingRetest()) {
      const token = await mintLinkToken(plan.lead_id);
      const subjectName = getMapDomain(plan.domain_id)?.displayName ?? plan.domain_id;
      const sent = await sendRetestEmail(
        plan.email,
        plan.child_name,
        subjectName,
        token,
        `${plan.child_id}.${plan.domain_id}`,
      );
      if (sent) {
        await markRetestEmailed(plan.plan_id);
        await emitMapEvent("map.retest_emailed", {
          lead_id: plan.lead_id,
          child_id: plan.child_id,
          domain: plan.domain_id,
        });
        retests += 1;
      }
    }
  } catch (error) {
    console.error("map/cron failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, reminders, bandReady, retests }, { status: 500 });
  }

  return Response.json({ ok: true, reminders, bandReady, retests });
}
