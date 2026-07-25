import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { maybeSendAdminDigest, type DigestOutcome } from "../../../../lib/admin/digest";
import { recordCronRun } from "../../../../lib/admin/heartbeat";
import {
  sweepThankYouCards,
  type ThankYouCardSweepResult,
} from "../../../../lib/cards/thank-you";
import { dripEnabled } from "../../../../lib/drip/flag";
import { runDripSweep, type DripSweepResult } from "../../../../lib/drip/sweep";
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
import { lessonListenEnabled } from "../../../../lib/lessons/flag";
import {
  sweepLessons,
  type LessonSweepResult,
} from "../../../../lib/lessons/worker";
import { reportStuckToolCalls } from "../../../../lib/observability/agent-trace";
import { subjectLessonsEnabled } from "../../../../lib/subject-lessons/flag";
import { staleSubjectLessonFailureEvent } from "../../../../lib/subject-lessons/stale-reaper";
import { reapStaleSubjectLessons } from "../../../../lib/subject-lessons/store";

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
 *   6. The thank-you card sweep (lib/cards/thank-you.ts): one real
 *      handwritten card per family, 48h after web onboarding completes.
 *      DARK unless THANK_YOU_CARDS_ENABLED + Handwrytten env are set.
 *   7. The founder digest (lib/admin/digest.ts): one internal email per
 *      day at HOMA_ADMIN_DIGEST_HOUR_UTC. DARK unless
 *      HOMA_ADMIN_DIGEST_EMAIL is set.
 *   8. The lesson sweep (lib/lessons/worker.ts): re-kicks stalled
 *      lesson analyses (bounded attempts), fails the exhausted with
 *      honest state, and enforces the 30-day raw-audio TTL. DARK
 *      unless HOMA_LESSON_LISTEN_ENABLED.
 *   9. Stale subject lesson runs fail after two hours without an automatic
 *      retry. DARK unless HOMA_SUBJECT_LESSONS_ENABLED is exactly true.
 *  10. Stuck tool calls (lib/observability/agent-trace.ts): counts any
 *      agent_tool_calls row still 'requested' 15 minutes on, which is
 *      well past the longest deadline a tool may declare. Read-only, it
 *      changes nothing; it exists so a frozen turn is visible within the
 *      hour instead of only through the 2h task-run reaper, which could
 *      say a run produced no output but never why.
 *
 * Every tick also writes one cron_runs heartbeat row (founder console
 * MJ-14), success or failure, so a dead cron is visible from /admin.
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
  let cards: ThankYouCardSweepResult = {
    skipped: true,
    enqueued: 0,
    sent: 0,
    mailed: 0,
    failed: 0,
  };
  let digest: DigestOutcome = { skipped: true, sent: false };
  let lessons: LessonSweepResult = {
    analysesRun: 0,
    lessonsFailed: 0,
    audioDeleted: 0,
  };
  let staleSubjectLessons = 0;
  let stuckToolCalls = 0;
  let drip: DripSweepResult = {
    skipped: true,
    considered: 0,
    setupSent: 0,
    reportSent: 0,
    loopBackSent: 0,
    revealedNeverReturnedSent: 0,
    kid2PendingSent: 0,
    midChecklistSent: 0,
    eligible: 0,
    capped: false,
  };

  try {
    for (const family of await familiesNeedingReminder()) {
      const token = await mintLinkToken(family.id);
      const sent = await sendReminderEmail(family.email, family.first_child, token, family.id);
      if (sent) {
        await markReminderSent(family.id);
        await emitMapEvent("map.reminder_sent", { family_id: family.id });
        reminders += 1;
      }
    }

    for (const child of await childrenNowInBand()) {
      const token = await mintLinkToken(child.family_id);
      const sent = await sendBandReadyEmail(child.email, child.child_name, token, child.family_id);
      if (sent) {
        await markBandReady(child.family_id, child.child_id);
        await emitMapEvent("map.band_ready_emailed", {
          family_id: child.family_id,
          child_id: child.child_id,
        });
        bandReady += 1;
      }
    }

    for (const plan of await plansNeedingRetest()) {
      const token = await mintLinkToken(plan.family_id);
      const isMonth = plan.subject_id === MONTH_PLAN_SUBJECT;
      const subjectName = isMonth
        ? "month"
        : (getMapSubject(plan.subject_id)?.displayName ?? plan.subject_id);
      // The month has no single-subject deep dive; its re-check is the
      // whole checklist at the child's current age (?start resume).
      const sent = await sendRetestEmail(
        plan.email,
        plan.child_name,
        subjectName,
        token,
        isMonth ? "" : `${plan.child_id}.${plan.subject_id}`,
        plan.family_id,
      );
      if (sent) {
        await markRetestEmailed(plan.plan_id);
        await emitMapEvent("map.retest_emailed", {
          family_id: plan.family_id,
          child_id: plan.child_id,
          subject: plan.subject_id,
        });
        retests += 1;
      }
    }
    purged = await purgeEmptyAnonymousLeads();
    stuckToolCalls = await reportStuckToolCalls();
    transcripts = await syncCallTranscripts();
    cards = await sweepThankYouCards();
    digest = await maybeSendAdminDigest();
    if (lessonListenEnabled()) {
      lessons = await sweepLessons();
    }
    if (subjectLessonsEnabled()) {
      const staleLessonReceipts = await reapStaleSubjectLessons();
      staleSubjectLessons = staleLessonReceipts.length;
      for (const receipt of staleLessonReceipts) {
        await emitMapEvent(
          "map.subject_lesson_failed",
          staleSubjectLessonFailureEvent(receipt),
        );
      }
    }
    // The onboarding drip (funnel work 2026-07-20). DARK by default: it runs
    // only when HOMA_DRIP_ENABLED is exactly "true", so nothing reaches a
    // real family until the copy clears review and compliance lands.
    if (dripEnabled()) {
      drip = await runDripSweep();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("map/cron failed:", message);
    await recordCronRun(
      "map_cron",
      false,
      {
        reminders,
        bandReady,
        retests,
        purged,
        transcripts,
        cards,
        digest,
        lessons,
        staleSubjectLessons,
        stuckToolCalls,
        drip,
      },
      message,
    );
    return Response.json(
      {
        ok: false,
        reminders,
        bandReady,
        retests,
        purged,
        transcripts,
        cards,
        digest,
        lessons,
        staleSubjectLessons,
        stuckToolCalls,
        drip,
      },
      { status: 500 },
    );
  }

  await recordCronRun("map_cron", true, {
    reminders,
    bandReady,
    retests,
    purged,
    transcripts,
    cards,
    digest,
    lessons,
    staleSubjectLessons,
    stuckToolCalls,
    drip,
  });
  return Response.json({
    ok: true,
    reminders,
    bandReady,
    retests,
    purged,
    transcripts,
    cards,
    digest,
    lessons,
    staleSubjectLessons,
    stuckToolCalls,
    drip,
  });
}
