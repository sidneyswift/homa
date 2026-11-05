import { after } from "next/server";

import { kickConversationRequests, kickConversationRecording } from "../../../../lib/conversation-request-kick";
import { conversationRequestResponse } from "../../../../lib/conversation-request-route";

export async function GET(request: Request) { return conversationRequestResponse(request); }
export async function POST(request: Request) {
  const response = await conversationRequestResponse(request);
  if (response.ok) {
    // Acceptance is already committed. Losing this accelerator cannot lose work
    // or change the receipt returned to the parent; scheduled pickup remains.
    after(async () => { await kickConversationRequests(); await kickConversationRecording(); });
  }
  return response;
}
