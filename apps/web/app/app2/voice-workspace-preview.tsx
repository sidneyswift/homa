"use client";

import { useRef } from "react";

import { Logo } from "../../components/brand/Logo";
import styles from "./voice-workspace-preview.module.css";

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

export function VoiceWorkspacePreview() {
  const stateDialog = useRef<HTMLDialogElement>(null);
  const stateButton = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.preview}>
      <main className={styles.screen}>
        <div className={styles.stage}>
          <Logo variant="mark" size={64} />
        </div>
      </main>
      <button className={styles.devButton} ref={stateButton} aria-haspopup="dialog" onClick={() => stateDialog.current?.showModal()}>Dev mode</button>
      <dialog className={styles.dialog} ref={stateDialog} aria-labelledby="state-title" aria-describedby="state-note" onClose={() => stateButton.current?.focus()}>
        <div className={styles.dialogHeader}>
          <h2 id="state-title">States to design</h2>
          <button onClick={() => stateDialog.current?.close()}>Close</button>
        </div>
        <ul className={styles.stateList}>
          {statesToDesign.map(([name, label, description]) => (
            <li key={name}>
              {label}<small>{description}</small>
            </li>
          ))}
        </ul>
        <p className={styles.note} id="state-note">Reference only. These states have not been designed or approved.</p>
      </dialog>
    </div>
  );
}
