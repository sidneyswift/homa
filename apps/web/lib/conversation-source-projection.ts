import { createHash } from "node:crypto";

import { recordingContent, type ConversationContentEvent } from "./conversation-recording";

export interface RecordedTextRevision {
  event_kind: string; content: string; content_offset: number;
  snapshot_present: boolean; content_snapshot_hash: string | null;
}

/** Final snapshots revise one segment, not the whole turn. An absent final
 * snapshot preserves its interrupted partial; an explicit empty string clears it. */
export function projectRecordedConversationText(revisions: readonly RecordedTextRevision[]): string {
  const completed: string[] = [];
  let current = "";
  for (const revision of revisions) {
    if (revision.event_kind === "message.received") continue;
    if (revision.event_kind === "message.appended") {
      if (revision.content_offset !== current.length) throw new Error("Incomplete conversation source segment");
      current += revision.content;
      if (revision.content_snapshot_hash && createHash("sha256").update(current).digest("hex") !== revision.content_snapshot_hash) {
        throw new Error("Conflicting conversation source segment");
      }
    } else {
      completed.push(revision.snapshot_present ? revision.content : current);
      current = "";
    }
  }
  return completed.join("") + current;
}

export function projectConversationText(events: readonly ConversationContentEvent[]): string {
  return projectRecordedConversationText(events.map((event, index) => {
    const value = recordingContent(event, index);
    return { event_kind: value.kind, content: value.content, content_offset: value.offset,
      snapshot_present: value.snapshotPresent, content_snapshot_hash: value.snapshotHash };
  }));
}
