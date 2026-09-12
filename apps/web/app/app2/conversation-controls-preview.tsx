"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Icon } from "../../components/design/Icon";
import { SlashComposer } from "../app/slash-composer";
import styles from "./voice-workspace-preview.module.css";

/** Local design controls only. View changes never acquire audio resources. */
export function ConversationControlsPreview() {
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const inputArea = useRef<HTMLDivElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const audioOptions = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOutside(event: Event) {
      const options = audioOptions.current;
      if (options?.open && event.target instanceof Node && !options.contains(event.target)) {
        if (event.type === "pointerdown" && options.contains(document.activeElement)) {
          options.querySelector("summary")?.focus({ preventScroll: true });
          // A click on blank canvas may move focus to body after pointerdown.
          requestAnimationFrame(() => {
            if (options.isConnected && !options.open && document.activeElement === document.body) {
              options.querySelector("summary")?.focus({ preventScroll: true });
            }
          });
        }
        options.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, []);

  function showKeyboard() {
    // Focus stays within the initiating gesture, including on mobile browsers.
    flushSync(() => setKeyboardVisible(true));
    inputArea.current?.querySelector("input")?.focus({ preventScroll: true });
  }

  function endVoice() {
    setMicrophoneOn(false);
    setSpeakerOn(false);
    if (audioOptions.current) audioOptions.current.open = false;
    showKeyboard();
  }

  return (
    <div className={styles.composerDock}>
      <form
        className={`${styles.composer} ${keyboardVisible ? "" : styles.compactComposer}`}
        aria-label={keyboardVisible ? "Chat input" : "Voice controls"}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.inputRow} hidden={!keyboardVisible}>
          <div className={styles.inputArea} ref={inputArea} id="preview-chat-input">
            <SlashComposer kids={[]} skills={[]} draft={draft} onDraftChange={setDraft} placeholder="Message Homa…" />
          </div>
          <button className={styles.iconButton} type="button" aria-label="Add attachment" title="Attachments are not connected yet" disabled><Icon name="add" size={20} /></button>
        </div>
        <div className={styles.composerActions}>
          <div className={styles.modeSelector} role="group" aria-label="Conversation view">
            <button type="button" className={styles.modeButton} aria-pressed={!keyboardVisible} ref={voiceButton} onClick={() => {
              voiceButton.current?.focus({ preventScroll: true });
              setKeyboardVisible(false);
            }}>Voice</button>
            <button type="button" className={styles.modeButton} aria-pressed={keyboardVisible} aria-controls="preview-chat-input" onClick={showKeyboard}>Text</button>
          </div>
          {keyboardVisible && <span className={styles.actionSpacer} />}
          <details className={styles.audioOptions} ref={audioOptions} onKeyDown={(event) => {
            if (event.key === "Escape" && audioOptions.current?.open) {
              audioOptions.current.open = false;
              audioOptions.current.querySelector("summary")?.focus();
            }
          }}>
            <summary aria-label="Settings" title="Settings"><Icon name="settings" size={20} /></summary>
            <div className={styles.audioOptionsPanel} role="group" aria-label="Audio settings">
              <button type="button" aria-pressed={microphoneOn} onClick={() => setMicrophoneOn((on) => !on)}>
                <Icon name={microphoneOn ? "voice" : "muted"} size={20} /><span>Mic</span>
              </button>
              <button type="button" aria-pressed={speakerOn} onClick={() => setSpeakerOn((on) => !on)}>
                <Icon name={speakerOn ? "volume" : "volume_muted"} size={20} /><span>Sound</span>
              </button>
              <button className={styles.endVoice} type="button" onClick={endVoice}>End voice</button>
            </div>
          </details>
          {keyboardVisible && <button className={styles.iconButton} type="submit" aria-label="Send message" title="Sending is not connected yet" disabled><Icon name="send" size={20} /></button>}
        </div>
      </form>
    </div>
  );
}
