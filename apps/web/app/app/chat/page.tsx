import type { Metadata } from "next";

import { getAppData } from "../../../lib/app-data";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { ChatClient } from "./chat-client";

/**
 * /app/chat: talk to Homa (trimmed M1-04 walking-skeleton slice), rendered
 * inside the /app frame like every signed-in surface. Auth is enforced
 * twice: proxy.ts gates the page, and the eve channel's supabaseAuth()
 * independently validates every agent request. The chat transcript
 * persists in localStorage keyed by user id (v0 of conversation
 * persistence; the Postgres conversations table is M1-02 scope). The
 * family row feeds the greeting and the family_id stamped on chat.*
 * events; getAppData is the same per-request read the layout already
 * did, so this adds no extra queries.
 */

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? "anonymous";
  const app = await getAppData();
  const { draft } = await searchParams;

  return (
    <ChatClient
      storageKey={`homa-chat-${userId}`}
      familyId={app?.family.id ?? null}
      parentName={app?.family.parent_display_name ?? null}
      // The journal email's deep link (?draft=journal) lands with the
      // composer already started; she edits and sends herself.
      initialDraft={draft === "journal" ? "Here's how today went: " : undefined}
    />
  );
}
