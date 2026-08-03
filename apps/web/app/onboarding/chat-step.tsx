"use client";

import { ChatClient } from "../app/chat-client";
import type { OnboardingChatProps } from "./onboarding-chat-props";

/**
 * The chat phase of onboarding
 * (plans/2026-07-21-chat-first-onboarding.md §2.1).
 *
 * Deliberately thin. It renders /app's own chat surface, not a copy of
 * it: the two share a session, a storage key, and a transcript, so the
 * handoff out of onboarding is not a handoff at all, it is the same
 * conversation continuing at a different URL. It also means onboarding
 * inherits lost-turn recovery, the stall triad, the queue, and the 4am
 * rotation, which matter more here than anywhere else in the product.
 *
 * The browser's own time zone is read inside the kickoff, where Intl
 * actually exists, rather than held here: gating the render on it would
 * put a blank frame exactly where the welcome belongs.
 */
export function ChatStep({ chat }: { chat: OnboardingChatProps }) {
  return (
    <div className="fixed inset-0 z-0 bg-[var(--homa-canvas)]">
      <ChatClient
        storageKey={chat.storageKey}
        familyId={chat.familyId}
        timeZone={chat.timeZone}
        parentName={chat.parentName}
        kids={chat.kids}
        slashSkills={chat.slashSkills}
        serverHistory={chat.serverHistory}
        wall={chat.wall}
        onboarding={{
          familyId: chat.familyId,
          parentName: chat.parentName,
          firstVisit: chat.firstVisit,
          gapMs: chat.gapMs,
        }}
      />
    </div>
  );
}
