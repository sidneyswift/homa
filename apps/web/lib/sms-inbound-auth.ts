export function trustedSmsInboundIdentityAttributes(input: {
  providerMessageId: string;
  inboundReceiptId: string;
}): {
  providerMessageId: string;
  inboundReceiptId: string;
} {
  const providerMessageId = input.providerMessageId.trim();
  const inboundReceiptId = input.inboundReceiptId.trim();
  if (!providerMessageId || !inboundReceiptId) {
    throw new TypeError(
      "SMS inbound identity requires provider message and receipt IDs",
    );
  }
  return { providerMessageId, inboundReceiptId };
}
