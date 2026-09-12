"use client";

import { useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";

import { Icon, type SemanticIconName } from "../../components/design/Icon";
import { SlashComposer } from "../app/slash-composer";
import styles from "./voice-workspace-preview.module.css";

type ConversationButtonProps = ComponentProps<"button"> & { icon?: SemanticIconName };

/** One control geometry for both composer shapes; state only changes treatment. */
function ConversationButton({ icon, children, className = "", type = "button", ...props }: ConversationButtonProps) {
  return (
    <button type={type} className={`${styles.iconButton} ${className}`} {...props}>
      {icon ? <Icon name={icon} size={20} /> : children}
    </button>
  );
}

/** Local design controls only. View changes never acquire audio resources. */
export function ConversationControlsPreview() {
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(true);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const inputArea = useRef<HTMLDivElement>(null);
  const keyboardButton = useRef<HTMLButtonElement>(null);

  function showKeyboard() {
    // Focus stays within the initiating gesture, including on mobile browsers.
    flushSync(() => setKeyboardVisible(true));
    inputArea.current?.querySelector("input")?.focus({ preventScroll: true });
  }

  function chooseTextOnly() {
    setMicrophoneOn(false);
    setSpeakerOn(false);
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
          <ConversationButton
            icon="collapse"
            type="button"
            aria-label="Hide keyboard"
            title="Hide keyboard without changing audio"
            onClick={() => {
              flushSync(() => setKeyboardVisible(false));
              keyboardButton.current?.focus();
            }}
          />
        </div>
        <div className={styles.composerActions}>
          {keyboardVisible ? (
            <>
              <ConversationButton icon="add" aria-label="Add attachment" title="Attachments are not connected yet" disabled />
              <span className={styles.actionSpacer} />
            </>
          ) : (
            <ConversationButton className={styles.typeButton} ref={keyboardButton} aria-label="Show keyboard" aria-controls="preview-chat-input" aria-expanded={false} title="Type without changing audio" onClick={showKeyboard}>Aa</ConversationButton>
          )}
          <ConversationButton
            icon={microphoneOn ? "voice" : "muted"}
            aria-label="Microphone"
            aria-pressed={microphoneOn}
            title={microphoneOn ? "Mute mic" : "Unmute mic"}
            onClick={() => setMicrophoneOn((on) => !on)}
          />
          <ConversationButton
            icon={speakerOn ? "volume" : "volume_muted"}
            aria-label="Homa speaker"
            aria-pressed={speakerOn}
            title={speakerOn ? "Silence Homa" : "Enable Homa's voice"}
            onClick={() => setSpeakerOn((on) => !on)}
          />
          <ConversationButton icon="close" aria-label="End voice" title="End voice and keep typing" onClick={chooseTextOnly} />
          {keyboardVisible && <ConversationButton icon="send" className={styles.sendButton} type="submit" aria-label="Send message" title="Sending is not connected yet" disabled />}
        </div>
      </form>
    </div>
  );
}
