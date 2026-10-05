"use client";

import type { WorkspaceActivityState } from "./workspace-activity";
import styles from "./voice-workspace-preview.module.css";

/** The current activity stays with Homa; completed work remains in the message. */
export function WorkspaceActivity({ activity, speaking = false }: { activity: WorkspaceActivityState; speaking?: boolean }) {
  return <div className={styles.activityBubble} role="status" aria-live={speaking ? "off" : "polite"} aria-atomic="true">
    <span key={activity.label} className={styles.activityLabelText}>
      <span className="chat-busy-label">{activity.label}</span>
    </span>
  </div>;
}
