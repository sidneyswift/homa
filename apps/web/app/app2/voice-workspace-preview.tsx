"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import { ConversationControlsPreview } from "./conversation-controls-preview";
import styles from "./voice-workspace-preview.module.css";

const HomaCharacter = dynamic(() => import("./homa-character"), { ssr: false, loading: () => <Logo variant="mark" size={144} /> });

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

export function VoiceWorkspacePreview({ family }: { family: App2Family | null }) {
  const [characterPaused, setCharacterPaused] = useState(false);
  const stateDialog = useRef<HTMLDialogElement>(null);
  const stateButton = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.preview}>
      <main className={styles.screen}>
        <div className={styles.stage}>
          <div className={styles.characterStage}><HomaCharacter paused={characterPaused} /></div>
        </div>
      </main>
      <ConversationControlsPreview family={family} />
      <button className={styles.devButton} ref={stateButton} aria-haspopup="dialog" onClick={() => stateDialog.current?.showModal()}>Dev mode</button>
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
        <p className={styles.note} id="state-note">The list is a reference for future designs. Voice connects to your Homa account and saves the conversation. You can type in the same voice session without muting your mic. Attachments are not connected yet. Character movement is still a design study.</p>
      </dialog>
    </div>
  );
}
