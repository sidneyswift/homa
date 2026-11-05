import { conversationFeedResponse } from "../../../../lib/conversation-feed";

export async function GET(request: Request) { return conversationFeedResponse(request); }
