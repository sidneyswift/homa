import type { ProgressCheckInStartOutcome } from "./types";

export type SelectedAssessmentStatus =
  | {status: "not_started" | "unavailable"}
  | {status: "accepted"; checkInId: string; revision: number}
  | {status: "delivered" | "terminal"; checkInId: string | null};

/** An accepted start is separate from delivery, and never authorizes a restart. */
export function assessmentStatusFromReceipt(input: {
  result: ProgressCheckInStartOutcome;
  issuedCheckInId: string | null;
  issuedRevision: number | null;
  deliveredAt: string | null;
  current: {id: string; state: string; revision: number; current_delivery_id: string | null;
    active_member_user_id: string | null; prompt_recipient_member_user_id: string | null} | null;
  memberUserId: string;
}): SelectedAssessmentStatus {
  const checkInId = "checkIn" in input.result ? input.result.checkIn.id : null;
  if (input.deliveredAt !== null) return {status: "delivered", checkInId};
  const current = input.current;
  if (current && current.id === input.issuedCheckInId && current.state === "active" &&
    current.revision === input.issuedRevision && current.current_delivery_id === null &&
    current.active_member_user_id === input.memberUserId && current.prompt_recipient_member_user_id === input.memberUserId) {
    return {status: "accepted", checkInId: current.id, revision: current.revision};
  }
  return {status: "terminal", checkInId};
}
