import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { maybeSendAdminDigest, type DigestOutcome } from "../../../../lib/admin/digest";
import { recordCronRun } from "../../../../lib/admin/heartbeat";
import {
  sweepThankYouCards,
  type ThankYouCardSweepResult,
} from "../../../../lib/cards/thank-you";
import {
  runFilingReminderSweep,
  type FilingReminderSweepResult,
} from "../../../../lib/compliance/filing-reminder-sweep";
import {
  runFilingDetailsSweep,
  type FilingDetailsSweepResult,
} from "../../../../lib/compliance/filing-details-sweep";
import { dripEnabled } from "../../../../lib/drip/flag";
import {
  runStrandedSweep,
  type StrandedSweepResult,
} from "../../../../lib/materials/stranded-sweep";
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
 *   4. Anonymous-lead cleanup is paused until it can use the same durable
 *      deletion receipt and cleanup worker as account deletion.
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
 *  11. The state filing reminder (lib/compliance/filing-reminder-sweep.ts,
 *      gh#422): one email per family per filing deadline, about two
 *      weeks out. The sweep runs every tick and the FLAG GUARDS THE
 *      SEND, not the pass, because while counsel review is open
 *      (gh#423) the number that matters is how many families are near a
 *      legal deadline and cannot be told. Its skip counts say why the
 *      send count is zero. DARK unless HOMA_FILING_REMINDERS_ENABLED is
 *      exactly "true". The gh#424 details drip rides the same flag.
 *  12. The stranded-chain follow-up (lib/materials/stranded-sweep.ts,
 *      gh#197, FD-2(c), founder ruling 2026-07-30): ONE quiet message
 *      per family, ever, about work that never reached final. Not one
 *      per draft: on 2026-07-30 one family had nine stranded drafts, and
 *      nine emails is exactly the nagging the ruling forbids. DARK
 *      unless HOMA_STRANDED_FOLLOWUP_ENABLED is exactly "true".
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
  let stranded: StrandedSweepResult = {
    sent: 0,
    eligible: 0,
    skipped: {
      no_email: 0,
      too_recent: 0,
      review_failed: 0,
      family_already_told: 0,
    },
    sendingEnabled: false,
  };
  let filingDetails: FilingDetailsSweepResult = {
    sent: 0,
    eligible: 0,
    skipped: {
      not_entitled: 0,
      no_email: 0,
      nothing_missing: 0,
      too_soon: 0,
      sequence_finished: 0,
    },
    sendingEnabled: false,
  };
  let filings: FilingReminderSweepResult = {
    sent: 0,
    eligible: 0,
    alreadySent: 0,
    skipped: {
      not_entitled: 0,
      no_email: 0,
      no_state: 0,
      state_asks_nothing: 0,
      needs_school_year_start: 0,
      no_deadline: 0,
      not_due_yet: 0,
    },
    sendingEnabled: false,
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
    // The filing reminder (gh#422). Unlike the drip, this runs on every
    // tick and the FLAG GUARDS THE SEND, not the sweep: while counsel
    // review is open (gh#423) the useful number is how many families are
    // near a legal deadline and cannot be told, and a sweep that does
    // not run cannot report it. Sending stays dark until
    // HOMA_FILING_REMINDERS_ENABLED is exactly "true".
    // The stranded-chain follow-up (gh#197, FD-2(c), founder ruling
    // 2026-07-30). One quiet message per family, EVER, about work that
    // never reached final. Same posture as the filing reminder: the pass
    // runs every tick so the eligible count is visible, and the flag
    // guards only the send. DARK unless HOMA_STRANDED_FOLLOWUP_ENABLED
    // is exactly "true".
    stranded = await runStrandedSweep(new Date().toISOString());
    // The filing-details drip (gh#424, founder ruling 3). At most three
    // nudges ever, widening 2/9/30 days, stopping the moment she fills
    // everything in. Shares the filing reminder's flag: counsel reviews
    // both as one thing, and turning on the urgent message while leaving
    // the calm one dark would be the wrong half.
    filingDetails = await runFilingDetailsSweep(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date()),
    );
    filings = await runFilingReminderSweep(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
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
        filings,
        filingDetails,
        stranded,
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
    filings,
    filingDetails,
    stranded,
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
    filings,
    filingDetails,
    stranded,
  });
}
