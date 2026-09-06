import assert from "node:assert/strict";
import { it } from "node:test";

import { assessmentStatusFromReceipt } from "./assessment-status";

it("only the owned issued unbound revision offers recovery; delivered and finished actions stay settled", () => {
  const input: Parameters<typeof assessmentStatusFromReceipt>[0] = {
    result: {status: "existing", prompt: null, checkIn: {
      id: "sitting", familyId: "family", childId: "child", childName: "Maya", purpose: "subject_deep_dive", scope: {subjectIds: ["math"]},
      state: "active", revision: 2, currentItemId: "math.counts-to-5", currentDeliveryId: null,
      ownerMemberUserId: "adult", recipientMemberUserId: "adult", ownerDisplayName: null, recipientDisplayName: null,
      episodeId: "episode", pendingRuntimeSessionId: "runtime", pendingTurnId: "turn", pauseReason: null,
      openedAt: "2026-09-06T12:00:00Z", updatedAt: "2026-09-06T12:00:00Z", pausedAt: null, stoppedAt: null, completedAt: null,
    }},
    issuedCheckInId: "sitting", issuedRevision: 2, deliveredAt: null, memberUserId: "adult",
    current: {id: "sitting", state: "active", revision: 2, current_delivery_id: null, active_member_user_id: "adult", prompt_recipient_member_user_id: "adult"},
  };
  assert.deepEqual(assessmentStatusFromReceipt(input), {status: "accepted", checkInId: "sitting", revision: 2});
  for (const change of [
    {current: null}, {issuedCheckInId: null, issuedRevision: null},
    ...[{state: "paused"}, {state: "stopped"}, {state: "completed"},
      {active_member_user_id: "partner"}, {prompt_recipient_member_user_id: "partner"}, {current_delivery_id: "delivery"}]
      .map(fields => ({current: {...input.current!, ...fields}})),
  ]) assert.equal(assessmentStatusFromReceipt({...input, ...change}).status, "terminal");
  assert.deepEqual(assessmentStatusFromReceipt({...input, current: {...input.current!, revision: 3}}), {status: "unavailable"},
    "an active owned unbound revision mismatch cannot erase recovery intent");
  assert.equal(assessmentStatusFromReceipt({...input, deliveredAt: "2026-09-06T12:00:00Z", current: {...input.current!, revision: 3}}).status, "delivered",
    "advancing clears the sitting delivery, but never erases the action delivery receipt");
});
