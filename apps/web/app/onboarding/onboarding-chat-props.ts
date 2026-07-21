import type { WallCheckout } from "../../lib/billing/wall-types";
import type { ChatHistoryPayload } from "../../lib/chat-history-model";
import type { SlashSkillItem } from "../../lib/slash-skills";

/**
 * Everything the chat phase needs, assembled once on the server
 * (plans/2026-07-21-chat-first-onboarding.md §2.8).
 *
 * The type lives on its own so the server page, the client shell, and
 * the flow can pass it down without any of them importing the others.
 * Null on every visit where the chat flow is off, which is the only way
 * the old card flow stays byte-identical while this ships.
 */
export interface OnboardingChatProps {
  /** The same key /app uses, so the two surfaces are one conversation. */
  storageKey: string;
  familyId: string;
  /** The family's stored zone, for transcript day separators. */
  timeZone: string;
  parentName: string | null;
  kids: { id: string; name: string; avatarUrl: string | null }[];
  slashSkills: SlashSkillItem[];
  serverHistory: ChatHistoryPayload | null;
  wall: WallCheckout | null;
  /** True when this family has never exchanged a message with Homa. */
  firstVisit: boolean;
  /** Since her last message, or null when there has never been one. */
  gapMs: number | null;
}

/**
 * visitShapeFromHistory(history, now): whether this is a first visit and
 * how long she has been away, derived from the same scrollback the
 * transcript renders.
 *
 * Her own messages are the clock, not Homa's. A drip email that arrived
 * overnight is not her coming back, and treating it as activity would
 * make a three-day return look like a three-hour one and skip the beat
 * that picks her up.
 */
export function visitShapeFromHistory(
  history: ChatHistoryPayload | null,
  now: number,
): { firstVisit: boolean; gapMs: number | null } {
  const messages = history?.messages ?? [];
  if (messages.length === 0) return { firstVisit: true, gapMs: null };
  let lastParentAt: number | null = null;
  for (const message of messages) {
    if (message.role !== "user") continue;
    if (lastParentAt === null || message.atMs > lastParentAt) {
      lastParentAt = message.atMs;
    }
  }
  if (lastParentAt === null) return { firstVisit: true, gapMs: null };
  return { firstVisit: false, gapMs: Math.max(0, now - lastParentAt) };
}
