import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { fetchChatHistory } from "../../lib/chat-history";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getAppShellData } from "../../lib/app-data";
import { VoiceWorkspacePreview } from "./voice-workspace-preview";

export const metadata: Metadata = {
  title: "App2 design preview",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default async function App2Page() {
  // #1158: a local design surface until the product behavior is designed.
  if (process.env.NODE_ENV !== "development") notFound();
  const app = await getAppShellData();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  const history = app && userId ? await fetchChatHistory({ familyId: app.family.id, userId, supabase }) : null;
  return <VoiceWorkspacePreview key={`${app?.family.id}:${userId ?? "anonymous"}`} durableConversation={process.env.HOMA_CONVERSATION_RECORDING === "1" && process.env.HOMA_CONVERSATION_REQUESTS === "1"} userId={userId} history={history} family={app ? {
    id: app.family.id,
    timeZone: app.family.time_zone ?? "America/New_York",
    children: app.children.map(child => ({ id: child.id, name: child.name })),
  } : null} />;
}
