import {
  openReplyLoop,
  type DeliveryAttempt,
} from "../conversation-continuity/delivery-ledger";
import {
  bindProgressCheckInDelivery,
  listActiveFamilyProgressCheckIns,
  pauseProgressCheckInForDeliveryOutcome,
} from "./runtime";
import {
  bindProgressCheckInAfterSuccessfulDelivery,
} from "./delivery-binding";

/**
 * Production composition for completed web, SMS, and email deliveries.
 */
export function bindDeliveredProgressCheckIn(input: {
  attempt: DeliveryAttempt;
  deliveryOutcome: "sent" | "uncertain" | "failed";
  runtimeSessionId: string;
  turnId: string;
  deliveredContent?: string;
  requireExactStatement?: boolean;
  now?: Date;
}) {
  return bindProgressCheckInAfterSuccessfulDelivery(input, {
    listFamilyCheckIns: listActiveFamilyProgressCheckIns,
    bindDelivery: bindProgressCheckInDelivery,
    pauseUndeliveredPrompt:
      pauseProgressCheckInForDeliveryOutcome,
    openReplyLoop,
  });
}
