"use server";

import { cookies } from "next/headers";

import { getMyFamily } from "../../lib/family";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ASSESSMENT_PENDING_COOKIE, assessmentActionFromHeader, parseAssessmentAction } from "../../lib/child-progress/assessment-intent";
import { parseProgressCheckInStartOutcome } from "../../lib/child-progress/check-in-schema";
import { liveProgressEnabled } from "../../lib/child-progress/flag";
import { assessmentStatusFromReceipt, type SelectedAssessmentStatus } from "../../lib/child-progress/assessment-status";

/** Reads the start receipt and its independent canonical delivery fact. */
export async function selectedAssessmentStatus(value: unknown): Promise<SelectedAssessmentStatus> {
  const action = parseAssessmentAction(value);
  if (!action || !liveProgressEnabled()) return {status: "unavailable"};
  try {
    const supabase = await createSupabaseServerClient();
    const [{data: auth}, family] = await Promise.all([supabase.auth.getUser(), getMyFamily()]);
    if (!auth.user || !family) return {status: "unavailable"};
    const {data: child, error: childError} = await supabase.from("children").select("id").eq("id", action.childId).eq("family_id", family.id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (!child || childError) return {status: "unavailable"};
    const {data: row, error} = await supabase.from("progress_check_in_start_requests").select("child_id, subject_id, result, issued_check_in_id, issued_revision, delivered_at").eq("family_id", family.id).eq("member_user_id", auth.user.id).eq("request_id", action.requestId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) return {status: "unavailable"};
    if (!row) return {status: "not_started"};
    if (row.child_id !== action.childId || row.subject_id !== action.subjectId || row.result === null) return {status: "unavailable"};
    const result = parseProgressCheckInStartOutcome(row.result);
    const {data: current, error: currentError} = row.issued_check_in_id && !row.delivered_at
      ? await supabase.from("progress_check_ins").select("id, state, revision, current_delivery_id, active_member_user_id, prompt_recipient_member_user_id")
        .eq("family_id", family.id).eq("child_id", action.childId).eq("id", row.issued_check_in_id).abortSignal(AbortSignal.timeout(8000)).maybeSingle()
      : {data: null, error: null};
    if (currentError) return {status: "unavailable"};
    return assessmentStatusFromReceipt({result, current, memberUserId: auth.user.id,
      issuedCheckInId: row.issued_check_in_id, issuedRevision: row.issued_revision, deliveredAt: row.delivered_at});
  } catch { return {status: "unavailable"}; }
}

/** Clears only this short-lived navigation pointer, never the selected-child preference. */
export async function clearSelectedAssessment(value: unknown): Promise<void> {
  const action = parseAssessmentAction(value);
  if (!action) return;
  const jar = await cookies();
  const pending = assessmentActionFromHeader(jar.get(ASSESSMENT_PENDING_COOKIE)?.value ?? null);
  if (pending?.requestId === action.requestId && pending.childId === action.childId && pending.subjectId === action.subjectId) jar.delete(ASSESSMENT_PENDING_COOKIE);
}
