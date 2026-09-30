"use client";

import { Icon } from "../../components/design/Icon";
import type { WorkspaceActivityState } from "./workspace-activity";
import styles from "./voice-workspace-preview.module.css";

export function WorkspaceActivity({ activity, speaking = false }: { activity: WorkspaceActivityState; speaking?: boolean }) {
  const previous = activity.steps.filter(step => step.state !== "active");
  const active = activity.steps.filter(step => step.state === "active");
  // The newest active step already owns the shimmer heading.
  const visible = [...previous.slice(-2), ...active.slice(0, -1)];
  return <div className={styles.thinking}>
    <div className={styles.activityLabel} role="status" aria-live={speaking ? "off" : "polite"} aria-atomic="true">
      <span key={activity.label} className={styles.activityLabelText}>
        <span className="chat-busy-label">{activity.label}</span>
      </span>
    </div>
    {visible.length > 0 && <ol className={styles.activitySteps} aria-label="Current activity">
      {visible.map(step => <li key={step.id} className={styles.activityStep} data-state={step.state}>
        <Icon name={step.state === "finished" ? "check" : step.state === "failed" ? "warning" : step.state === "waiting" ? "pause" : "tools"} size={16} />
        <span>{step.label}</span>
        <span className={styles.activityStepState}>{step.state === "finished" ? "Finished" : step.state === "failed" ? "Not completed" : step.state === "waiting" ? "Waiting for you" : "In progress"}</span>
      </li>)}
    </ol>}
  </div>;
}
