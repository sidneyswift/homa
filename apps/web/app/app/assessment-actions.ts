"use server";

import { cookies } from "next/headers";

import { getMyFamily } from "../../lib/family";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ASSESSMENT_PENDING_COOKIE, assessmentActionFromHeader, parseAssessmentAction } from "../../lib/child-progress/assessment-intent";
import { parseProgressCheckInStartOutcome } from "../../lib/child-progress/check-in-schema";
import { liveProgressEnabled } from "../../lib/child-progress/flag";

/** Reads acceptance only. Canonical assistant delivery remains a separate fact. */
export async function selectedAssessmentStatus(value: unknown): Promise<
  {status: "not_started"} | {status: "accepted"; checkInId: string | null} | {status: "unavailable"}
> {
  const action = parseAssessmentAction(value);
  if (!action || !liveProgressEnabled()) return {status: "unavailable"};
  try {
    const supabase = await createSupabaseServerClient();
    const [{data: auth}, family] = await Promise.all([supabase.auth.getUser(), getMyFamily()]);
    if (!auth.user || !family) return {status: "unavailable"};
    const {data: child, error: childError} = await supabase.from("children").select("id").eq("id", action.childId).eq("family_id", family.id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (!child || childError) return {status: "unavailable"};
    const {data: row, error} = await supabase.from("progress_check_in_start_requests").select("child_id, subject_id, result").eq("family_id", family.id).eq("member_user_id", auth.user.id).eq("request_id", action.requestId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
    if (error) return {status: "unavailable"};
    if (!row) return {status: "not_started"};
    if (row.child_id !== action.childId || row.subject_id !== action.subjectId || row.result === null) return {status: "unavailable"};
    const result = parseProgressCheckInStartOutcome(row.result);
    return {status: "accepted", checkInId: "checkIn" in result ? result.checkIn.id : null};
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
