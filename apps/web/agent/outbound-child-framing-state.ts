import { defineState } from "eve/context";

interface OutboundChildFramingState {
  approvedText: string | null;
}

export const outboundChildFramingState = defineState<OutboundChildFramingState>(
  "homa.outbound-child-framing",
  () => ({ approvedText: null }),
);

export function approveOutboundChildFraming(text: string): void {
  outboundChildFramingState.update(() => ({ approvedText: text }));
}

export function resetOutboundChildFramingApproval(): void {
  outboundChildFramingState.update(() => ({ approvedText: null }));
}

export function currentOutboundChildFramingApproval(): string | null {
  return outboundChildFramingState.get().approvedText;
}
