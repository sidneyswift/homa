import { getMapDomain, MONTH_PLAN_DOMAIN } from "@homa/core";

import { sendBandReadyEmail, sendReminderEmail, sendRetestEmail } from "../../../../lib/map/email";
import { emitMapEvent } from "../../../../lib/map/events";
import {
  childrenNowInBand,
  familiesNeedingReminder,
  markBandReady,
  markReminderSent,
  markRetestEmailed,
  plansNeedingRetest,
  mintLinkToken,
  purgeEmptyAnonymousLeads,
} from "../../../../lib/map/store";
import {
  syncCallTranscripts,
  type TranscriptSyncResult,
} from "../../../../lib/voice/transcript-sync";

/**
 * GET /api/map/cron  (Vercel cron, hourly)
 * The promise-keeping jobs plus hygiene in one pass:
 *   1. The single 24h reminder for parked flows (one send ever, never a
 *      sequence: reminder_sent_at is checked and stamped).
 *   2. The band-ready promise: children captured outside the scored range
 *      get their checklist email automatically the moment their band ships.
 *   3. The retest loop: four weeks after a plan is built, one email invites
 *      the re-check that makes the numbers visibly move.
 *   4. Hygiene: anonymous leads with no email and no kids purge after a
 *      week (see purgeEmptyAnonymousLeads for why this is zero-loss).
 *   5. Call-transcript capture + the post-call memory turn ("save every
 *      call ALWAYS", founder ruling 2026-07-09; agentic ladder items 2-3).
 *      Skips cleanly when TELNYX_API_KEY is absent.
 *
 * The evening journal prompt moved OUT of this cron: loops that talk to
 * families wake the agent (gateway-plan GW-4; agent/schedules/dispatch.ts
 * is its home now). This cron keeps receipts and pipelines only.
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
  let purged = 0;
  let transcripts: TranscriptSyncResult = {
    scanned: 0,
    stored: 0,
    linked: 0,
    extracted: 0,
    skipped: true,
  };

  try {
    for (const family of await familiesNeedingReminder()) {
      const token = await mintLinkToken(family.id);
      const sent = await sendReminderEmail(family.email, family.first_child, token);
      if (sent) {
        await markReminderSent(family.id);
        await emitMapEvent("map.reminder_sent", { family_id: family.id });
        reminders += 1;
      }
    }

    for (const child of await childrenNowInBand()) {
      const token = await mintLinkToken(child.family_id);
      const sent = await sendBandReadyEmail(child.email, child.child_name, token);
      if (sent) {
        await markBandReady(child.child_id);
        await emitMapEvent("map.band_ready_emailed", {
          family_id: child.family_id,
          child_id: child.child_id,
        });
        bandReady += 1;
      }
    }

    for (const plan of await plansNeedingRetest()) {
      const token = await mintLinkToken(plan.family_id);
      const isMonth = plan.domain_id === MONTH_PLAN_DOMAIN;
      const subjectName = isMonth
        ? "month"
        : (getMapDomain(plan.domain_id)?.displayName ?? plan.domain_id);
      // The month has no single-subject deep dive; its re-check is the
      // whole checklist at the child's current age (?start resume).
      const sent = await sendRetestEmail(
        plan.email,
        plan.child_name,
        subjectName,
        token,
        isMonth ? "" : `${plan.child_id}.${plan.domain_id}`,
      );
      if (sent) {
        await markRetestEmailed(plan.plan_id);
        await emitMapEvent("map.retest_emailed", {
          family_id: plan.family_id,
          child_id: plan.child_id,
          domain: plan.domain_id,
        });
        retests += 1;
      }
    }
    purged = await purgeEmptyAnonymousLeads();
    transcripts = await syncCallTranscripts();
  } catch (error) {
    console.error("map/cron failed:", error instanceof Error ? error.message : "unknown");
    return Response.json(
      { ok: false, reminders, bandReady, retests, purged, transcripts },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, reminders, bandReady, retests, purged, transcripts });
}
