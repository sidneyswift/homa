"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Icon } from "../../components/design/Icon";
import { SlashComposer } from "../app/slash-composer";
import styles from "./voice-workspace-preview.module.css";

/** Local design controls only. View changes never acquire audio resources. */
export function ConversationControlsPreview() {
  const [pointerFocus, setPointerFocus] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const inputArea = useRef<HTMLDivElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);

  function openSettings() {
    flushSync(() => setSettingsOpen(true));
    backButton.current?.focus({ preventScroll: true });
  }

  function closeSettings() {
    flushSync(() => setSettingsOpen(false));
    settingsButton.current?.focus({ preventScroll: true });
  }

  function showKeyboard() {
    // Focus stays within the initiating gesture, including on mobile browsers.
    flushSync(() => setKeyboardVisible(true));
    inputArea.current?.querySelector("input")?.focus({ preventScroll: true });
  }

  function endVoice() {
    setMicrophoneOn(false);
    setSpeakerOn(false);
    setSettingsOpen(false);
    showKeyboard();
  }

  return (
    <div className={styles.composerDock}>
      <form
        className={`${styles.composer} ${settingsOpen ? styles.settingsComposer : keyboardVisible ? "" : styles.compactComposer}`}
        aria-label={settingsOpen ? "Audio settings" : keyboardVisible ? "Chat input" : "Voice controls"}
        onKeyDown={(event) => {
          if (settingsOpen && event.key === "Escape") {
            event.preventDefault();
            closeSettings();
          }
        }}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={`${styles.conversationView} ${keyboardVisible ? styles.expandedView : ""}`} hidden={settingsOpen}>
          <div className={styles.inputRow} hidden={!keyboardVisible}>
            <div className={styles.inputArea} ref={inputArea} id="preview-chat-input">
              <SlashComposer kids={[]} skills={[]} draft={draft} onDraftChange={setDraft} placeholder="Message Homa…" />
            </div>
          </div>
          <div className={styles.modeSelector} role="group" aria-label="Conversation view">
            <button className={styles.iconButton} type="button" aria-label="Settings" aria-controls="preview-audio-settings" aria-expanded={settingsOpen} ref={settingsButton} onClick={openSettings}><Icon name="settings" size={20} /></button>
            <button type="button" className={styles.modeButton} aria-pressed={keyboardVisible} aria-controls="preview-chat-input" onClick={showKeyboard}>Text</button>
            <button type="button" className={styles.modeButton} aria-pressed={!keyboardVisible} ref={voiceButton} data-pointer-focus={pointerFocus} onBlur={() => setPointerFocus(false)} onKeyDown={() => setPointerFocus(false)} onClick={(event) => {
              setPointerFocus(event.detail > 0);
              voiceButton.current?.focus({ preventScroll: true });
              setKeyboardVisible(false);
            }}>Voice</button>
          </div>
          <div className={styles.composerActions} hidden={!keyboardVisible}>
            {keyboardVisible && <button className={styles.iconButton} type="button" aria-label="Add attachment" title="Attachments are not connected yet" disabled><Icon name="add" size={20} /></button>}
            {keyboardVisible && <span className={styles.actionSpacer} />}
            {keyboardVisible && <button className={styles.iconButton} type="submit" aria-label="Send message" title="Sending is not connected yet" disabled><Icon name="send" size={20} /></button>}
          </div>
        </div>
        <div className={styles.settingsView} id="preview-audio-settings" hidden={!settingsOpen}>
          <div className={styles.settingsControls}>
            <button className={styles.iconButton} type="button" aria-label="Back to conversation controls" ref={backButton} onClick={closeSettings}><Icon name="back" size={20} /></button>
            <button type="button" aria-pressed={microphoneOn} onClick={() => setMicrophoneOn((on) => !on)}>
              <Icon name={microphoneOn ? "voice" : "muted"} size={20} /><span>Mic</span>
            </button>
            <button type="button" aria-pressed={speakerOn} onClick={() => setSpeakerOn((on) => !on)}>
              <Icon name={speakerOn ? "volume" : "volume_muted"} size={20} /><span>Sound</span>
            </button>
            <button type="button" onClick={endVoice}>End voice</button>
          </div>
        </div>
      </form>
    </div>
  );
}
