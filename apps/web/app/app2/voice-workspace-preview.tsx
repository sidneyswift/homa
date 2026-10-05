"use client";

import { motion as motionContract } from "@homa/design/motion";
import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import type { ChatHistoryPayload } from "../../lib/chat-history-model";
import { ConversationControlsPreview } from "./conversation-controls-preview";
import styles from "./voice-workspace-preview.module.css";
import { WorkspaceShell, useWorkspaceShell } from "./workspace-shell";

const HomaCharacter = dynamic(() => import("./homa-character"), { ssr: false, loading: () => null });

const characterEase = motionContract.easeOut.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];

const statesToDesign = [
  ["listening", "Listening", "Voice just started"],
  ["thinking", "Thinking", "Homa is preparing a reply"],
  ["speaking", "Speaking", "Homa answers"],
  ["working", "Working in the background", "You can keep talking"],
  ["ready", "Something is ready", "A result arrives"],
  ["paused", "Voice paused", "Microphone and audio off"],
  ["text", "Text only", "Keep the same conversation"],
  ["ended", "Conversation ended", "Start again when you want"],
] as const;

export interface App2Family {
  id: string;
  timeZone: string;
  children: Array<{ id: string; name: string }>;
}

type PreviewProps = { durableConversation?: boolean; family: App2Family | null; userId: string | null; history: ChatHistoryPayload | null };
export function VoiceWorkspacePreview(props: PreviewProps) {
  return <WorkspaceShell userId={props.userId} key={`${props.family?.id ?? ""}:${props.userId ?? ""}`}><WorkspaceConversation {...props} /></WorkspaceShell>;
}

function WorkspaceConversation({ family, userId, history, durableConversation = false }: PreviewProps) {
  const { openPlanner, workspaceOpen, conversationCovered, onPlanRevision } = useWorkspaceShell();
  const [characterPaused, setCharacterPaused] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [activityTarget, setActivityTarget] = useState<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const stateDialog = useRef<HTMLDialogElement>(null);
  const stateButton = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.preview} data-engaged={engaged || workspaceOpen}>
      <main className={styles.screen} inert={conversationCovered} aria-hidden={conversationCovered || undefined}>
        <div className={styles.stage}>
          <motion.div layout initial={false} className={styles.characterStage} transition={{ layout: { duration: reducedMotion ? 0 : motionContract.durations.slow / 1000, ease: characterEase } }}><HomaCharacter paused={characterPaused} /></motion.div>
          <motion.div layout="position" initial={false} className={styles.activityAnchor} ref={setActivityTarget} transition={{ layout: { duration: reducedMotion ? 0 : motionContract.durations.slow / 1000, ease: characterEase } }} />
        </div>
      </main>
      <ConversationControlsPreview activityTarget={activityTarget} durableConversation={durableConversation} family={family} userId={userId} history={history} workspaceEngaged={engaged || workspaceOpen} onEngagedChange={setEngaged} onOpenPlanner={openPlanner} conversationCovered={conversationCovered} onPlanRevision={onPlanRevision} />
      <button hidden className={styles.devButton} ref={stateButton} aria-haspopup="dialog" onClick={() => stateDialog.current?.showModal()}>Dev mode</button>
      <dialog className={styles.dialog} ref={stateDialog} aria-labelledby="state-title" aria-describedby="state-note" onClose={() => stateButton.current?.focus()}>
        <div className={styles.dialogHeader}>
          <h2 id="state-title">States to design</h2>
          <button onClick={() => stateDialog.current?.close()}>Close</button>
        </div>
        <button className={styles.characterPause} aria-pressed={characterPaused} onClick={() => setCharacterPaused(paused => !paused)}>{characterPaused ? "Resume character motion" : "Pause character motion"}</button>
        <ul className={styles.stateList}>
          {statesToDesign.map(([name, label, description]) => (
            <li key={name}>
              {label}<small>{description}</small>
            </li>
          ))}
        </ul>
        <p className={styles.note} id="state-note">The list is a reference for future designs. Voice connects to your Homa account and saves the conversation. You can type in the same voice session without muting your mic. Photos and files use the main chat attachment flow. Typed messages and attachments receive replies here. Character movement is still a design study.</p>
      </dialog>
    </div>
  );
}
