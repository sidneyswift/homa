import {
  submitReportEmail,
  type HomaEmailSubmission,
} from "./email";
import { claimReportEmail, releaseReportEmailClaim } from "./store";

/**
 * The one report email a child ever gets: their durable copy of the
 * report link, sent on first scoring only (rescores after a deep dive
 * must not re-send it). Exactly-once is enforced HERE, not at the call
 * sites: the atomic emailed_at claim is taken before the send, so two
 * concurrent scorings of the same child agree on a single sender. The
 * previous read-then-send-then-mark shape at each call site let both
 * pass the stale read and email the family twice (seen live 2026-07-18,
 * three doubled sends across two families; a mid-beat page refresh
 * re-POSTs /api/map/score the same way).
 *
 * A claim whose submit did not go out ("rejected" or "unknown") is
 * released so the next scoring retries, preserving the retry behavior
 * the old mark-after-success gave. "unknown" (timeout, 429, 5xx) may
 * rarely have delivered, so a later retry can duplicate; that risk
 * predates this module and needs a provider-side idempotency key to
 * close fully.
 */

/** Injection seams for tests; production callers pass nothing. */
export interface ReportEmailOnceOptions {
  claim?: typeof claimReportEmail;
  release?: typeof releaseReportEmailClaim;
  submit?: typeof submitReportEmail;
}

export async function sendReportEmailOnce(
  familyId: string,
  childId: string,
  to: string,
  childName: string,
  reportToken: string,
  options: ReportEmailOnceOptions = {},
): Promise<void> {
  const claim = options.claim ?? claimReportEmail;
  const release = options.release ?? releaseReportEmailClaim;
  const submit = options.submit ?? submitReportEmail;

  if (!(await claim(familyId, childId))) return;
  let submission: HomaEmailSubmission = { status: "unknown" };
  try {
    submission = await submit(to, childName, reportToken, familyId);
  } finally {
    if (submission.status !== "submitted") {
      await release(familyId, childId);
    }
  }
}
