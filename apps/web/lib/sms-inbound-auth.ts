import type {
  ActiveSmsProgressContext,
} from "./child-progress/active-sms-progress-context";

export function trustedSmsInboundIdentityAttributes(input: {
  providerMessageId: string;
  inboundReceiptId: string;
  activeProgressContext?: ActiveSmsProgressContext | null;
}): {
  providerMessageId: string;
  inboundReceiptId: string;
  activeProgressCheckInId?: string;
  activeProgressDeliveryId?: string;
} {
  const providerMessageId = input.providerMessageId.trim();
  const inboundReceiptId = input.inboundReceiptId.trim();
  if (!providerMessageId || !inboundReceiptId) {
    throw new TypeError(
      "SMS inbound identity requires provider message and receipt IDs",
    );
  }
  const activeProgressCheckInId =
    input.activeProgressContext?.checkInId.trim();
  const activeProgressDeliveryId =
    input.activeProgressContext?.deliveryId.trim();
  if (
    input.activeProgressContext &&
    (!activeProgressCheckInId || !activeProgressDeliveryId)
  ) {
    throw new TypeError(
      "SMS active progress identity requires check-in and delivery IDs",
    );
  }
  return {
    providerMessageId,
    inboundReceiptId,
    ...(activeProgressCheckInId && activeProgressDeliveryId
      ? {
          activeProgressCheckInId,
          activeProgressDeliveryId,
        }
      : {}),
  };
}
