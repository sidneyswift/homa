import type { Metadata } from "next";

import { ChatClient } from "./chat-client";

/**
 * /chat: talk to Homa (trimmed M1-04 walking-skeleton slice). Auth is
 * enforced twice: proxy.ts gates the page, and the eve channel's
 * supabaseAuth() independently validates every agent request.
 */

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false },
};

export default function ChatPage() {
  return <ChatClient />;
}
