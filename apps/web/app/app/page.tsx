import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getAppData } from "../../lib/app-data";
import { familyWallCheckout } from "../../lib/billing/wall";
import { fetchChatHistory } from "../../lib/chat-history";
import { getSlashMenuSkills } from "../../lib/slash-skills";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { effectiveTimeZone } from "../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../lib/view-context";
import { ChatClient } from "./chat-client";

/**
 * /app: talk to Homa, the app's default landing (founder ask 2026-07-09:
 * chat over dashboard as the front door; the dashboard moved to
 * the in-app report). Rendered inside the /app frame like every signed-in
 * surface. Auth is enforced twice: proxy.ts gates the page, and the eve
 * channel's supabaseAuth() independently validates every agent request.
 * The chat transcript persists in localStorage keyed by user id (v0 of
 * conversation persistence; the Postgres conversations table is M1-02
 * scope). The family row feeds the greeting and the family_id stamped
 * on chat.* events; getAppData is the same per-request read the layout
 * already did, so this adds no extra queries.
 */

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false },
};

/** Sentinel to composer prefill. A closed set on purpose: a deep link
 * may choose a prepared opening, never inject arbitrary text into her
 * composer from a URL. */
const DRAFT_PREFILLS: Record<string, string | undefined> = {
  journal: "Here's how today went: ",
  "schedule-week": "Put this week's school work on real days for me: ",
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

  // The context switcher's selection: when one kid is selected, the
  // composer says so and the agent hears it (the eve channel reads the
  // same cookie off every turn's request).
  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    (app?.children ?? []).map((child) => child.id),
  );
  const focusChild =
    viewContext.kind === "child"
      ? (app?.children ?? []).find((child) => child.id === viewContext.childId) ?? null
      : null;

  // The composer's "/" menu: kids to mention, plus the same repo skill
  // packages the agent sees (filesystem-first fleet skills, 2026-07-15).
  const slashSkills = await getSlashMenuSkills();

  // The wall (plans/2026-07-11-the-wall.md): the first chat message is a
  // door. Null while the flag is off (the instant no-query path), and
  // for exempt or trialing families.
  const wall = app ? await familyWallCheckout(app.family.id) : null;

  // The per-adult scrollback from Postgres (M1-02 render slice +
  // chat-privacy-per-adult, 2026-07-12): the same thread on every
  // device. Null on failure; the client falls back to its local cache.
  const serverHistory =
    app && userId !== "anonymous"
      ? await fetchChatHistory({ familyId: app.family.id, userId })
      : null;

  return (
    <ChatClient
      wall={wall}
      serverHistory={serverHistory}
      storageKey={`homa-chat-${userId}`}
      familyId={app?.family.id ?? null}
      timeZone={effectiveTimeZone(app?.family.time_zone)}
      parentName={app?.memberDisplayName ?? app?.family.parent_display_name ?? null}
      focusChildName={focusChild?.name ?? null}
      focusChildId={focusChild?.id ?? null}
      kids={(app?.children ?? []).map((child) => ({
        id: child.id,
        name: child.name,
        avatarUrl: child.avatar_url,
      }))}
      slashSkills={slashSkills}
      // Deep links land with the composer already started; she edits and
      // sends herself. `journal` comes from the journal email;
      // `schedule-week` comes from an empty /app/calendar, which is the
      // one place a parent learns that school work needs real dates
      // before the calendar (or a reshuffle) can do anything with it.
      initialDraft={DRAFT_PREFILLS[draft ?? ""]}
    />
  );
}
