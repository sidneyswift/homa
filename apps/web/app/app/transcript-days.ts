import type { EveMessage } from "eve/client";

import type { ArchivedMessage } from "./chat-storage";

/**
 * Day grouping for the chat transcript (founder direction 2026-07-10
 * evening, the Slack-channel reading of the one thread): messages from
 * past days render under date separators ("Yesterday", "Monday, July 6")
 * so old conversation reads as old instead of resuming mid-thought.
 * Pure logic, no JSX; the chat client renders the items.
 *
 * Times are client-observed (chat-storage.ts). Messages persisted before
 * timestamps existed group under one "Earlier" separator at the top.
 */

export type TranscriptItem =
  | { kind: "separator"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: EveMessage;
      /** "Texted", "By email", "From Homa's tasks": shown under a bubble
       * that arrived from another surface, only where the surface
       * changes (a run of texts gets one tag, not one per bubble). */
      sourceLabel?: string;
    };

/** One local-day bucket, used to decide where separators go. */
function dayKeyOf(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * dayLabelFor(at, now): the compact one-line day header (founder call
 * 2026-07-13, chat-refined question 3): "Today · July 13",
 * "Yesterday · July 12", "Tuesday · July 14", and "July 3 · 2025" once
 * the year differs. Local time on purpose: the separator answers "when
 * was this, for the person reading it here".
 */
export function dayLabelFor(at: number, now: number = Date.now()): string {
  const day = dayKeyOf(at);
  const date = new Date(at);
  const monthDay = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  if (day === dayKeyOf(now)) return `Today · ${monthDay}`;
  if (day === dayKeyOf(now - 24 * 60 * 60 * 1000)) return `Yesterday · ${monthDay}`;
  if (date.getFullYear() === new Date(now).getFullYear()) {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${weekday} · ${monthDay}`;
  }
  return `${monthDay} · ${date.getFullYear()}`;
}

/**
 * sourceLabelFor(role, channel): the little tag under a bubble that
 * arrived from another surface (founder direction 2026-07-12, the
 * one-thread merge: "tag the bubble with where it's from"). Device
 * tags sit only under the parent's own messages; Homa's bubbles carry
 * a tag only when a scheduled task produced them (the persona-review
 * rule: a device tag under Homa's own reply reads as noise).
 */
export function sourceLabelFor(
  role: string,
  channel: string | undefined,
): string | null {
  if (!channel) return null;
  if (role === "user" && channel === "sms") return "Texted";
  if (role === "user" && channel === "email") return "By email";
  if (role === "assistant" && channel === "dispatch") return "From Homa's tasks";
  return null;
}

/**
 * buildTranscript(...): archived history first, then the live session,
 * with a separator wherever the local day changes. Item keys are
 * namespaced (archived vs live) because eve message ids restart with
 * each session (`turn_1:user` exists in every session).
 *
 * A live message without a stamped time is treated as arriving now
 * (it is live; stamps land when the turn finishes). Archived messages
 * without times are legacy saves and group under one "Earlier" label.
 */
export function buildTranscript(input: {
  archived: readonly ArchivedMessage[];
  live: readonly EveMessage[];
  liveTimes: Record<string, number>;
  now?: number;
}): TranscriptItem[] {
  const now = input.now ?? Date.now();
  const items: TranscriptItem[] = [];
  let previousDay: string | null = null;
  let earlierShown = false;
  // Tags mark surface CHANGES: a run of texted messages reads as one
  // texted stretch. The thread itself is the web surface, so "web"
  // starts the comparison.
  let previousChannel = "web";

  const push = (
    key: string,
    message: EveMessage,
    at: number | null,
    channel?: string,
  ) => {
    if (at === null) {
      if (!earlierShown && items.length === 0) {
        earlierShown = true;
        items.push({ kind: "separator", key: `sep:${key}`, label: "Earlier" });
      }
    } else {
      const day = dayKeyOf(at);
      if (day !== previousDay) {
        previousDay = day;
        items.push({
          kind: "separator",
          key: `sep:${key}`,
          label: dayLabelFor(at, now),
        });
      }
    }
    const label =
      channel && channel !== previousChannel
        ? sourceLabelFor(message.role, channel)
        : null;
    if (channel) previousChannel = channel;
    items.push({
      kind: "message",
      key,
      message,
      ...(label ? { sourceLabel: label } : {}),
    });
  };

  input.archived.forEach((entry, index) => {
    push(`a${index}:${entry.message.id}`, entry.message, entry.at, entry.channel);
  });
  previousChannel = "web";
  for (const message of input.live) {
    push(`m:${message.id}`, message, input.liveTimes[message.id] ?? now);
  }
  return items;
}
