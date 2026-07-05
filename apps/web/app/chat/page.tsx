import type { Metadata } from "next";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ChatClient } from "./chat-client";

/**
 * /chat: talk to Homa (trimmed M1-04 walking-skeleton slice). Auth is
 * enforced twice: proxy.ts gates the page, and the eve channel's
 * supabaseAuth() independently validates every agent request. The chat
 * transcript persists in localStorage keyed by user id (v0 of conversation
 * persistence; the Postgres conversations table is M1-02 scope).
 */

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false },
};

export default async function ChatPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? "anonymous";

  return <ChatClient storageKey={`homa-chat-${userId}`} />;
}
