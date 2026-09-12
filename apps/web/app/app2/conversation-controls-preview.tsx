"use client";

import { useRef, useState } from "react";
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
        </div>
        <div className={styles.composerActions}>
          <div className={styles.modeSelector} role="group" aria-label="Conversation view">
            <button type="button" className={styles.modeButton} aria-pressed={!keyboardVisible} ref={voiceButton} onClick={() => {
              voiceButton.current?.focus({ preventScroll: true });
              setKeyboardVisible(false);
            }}>Voice</button>
            <button type="button" className={styles.modeButton} aria-pressed={keyboardVisible} aria-controls="preview-chat-input" onClick={showKeyboard}>Text</button>
          </div>
          {keyboardVisible && (
            <>
              <span className={styles.actionSpacer} />
              <button className={styles.iconButton} type="button" aria-label="Add attachment" title="Attachments are not connected yet" disabled><Icon name="add" size={20} /></button>
              <button className={styles.iconButton} type="submit" aria-label="Send message" title="Sending is not connected yet" disabled><Icon name="send" size={20} /></button>
            </>
          )}
        </div>
      </form>
      <div className={styles.audioSettings} role="group" aria-label="Audio settings">
        <button className={styles.audioSetting} type="button" aria-pressed={microphoneOn} onClick={() => setMicrophoneOn((on) => !on)}>
          <Icon name={microphoneOn ? "voice" : "muted"} size={16} />
          <span>Mic {microphoneOn ? "on" : "off"}</span>
        </button>
        <button className={styles.audioSetting} type="button" aria-pressed={speakerOn} onClick={() => setSpeakerOn((on) => !on)}>
          <Icon name={speakerOn ? "volume" : "volume_muted"} size={16} />
          <span>Sound {speakerOn ? "on" : "off"}</span>
        </button>
        <details className={styles.audioOptions} ref={audioOptions} onKeyDown={(event) => {
          if (event.key === "Escape" && audioOptions.current?.open) {
            audioOptions.current.open = false;
            audioOptions.current.querySelector("summary")?.focus();
          }
        }}>
          <summary aria-label="More audio options" title="More audio options"><Icon name="more" size={16} /></summary>
          <div className={styles.audioOptionsPanel}>
            <button type="button" onClick={endVoice}>End voice</button>
          </div>
        </details>
      </div>
    </div>
  );
}
