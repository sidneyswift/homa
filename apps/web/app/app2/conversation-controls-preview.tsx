"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Icon } from "../../components/design/Icon";
import { SlashComposer } from "../app/slash-composer";
import { AdaptiveIsland, IslandView } from "./adaptive-island";
import styles from "./voice-workspace-preview.module.css";

/** Local design controls only. View changes never acquire audio resources. */
export function ConversationControlsPreview() {
  const [pointerFocus, setPointerFocus] = useState<"voice" | "settings" | "back" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const inputArea = useRef<HTMLDivElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);

  function openSettings(fromPointer = false) {
    flushSync(() => setSettingsOpen(true));
    backButton.current?.focus({ preventScroll: true });
    setPointerFocus(fromPointer ? "back" : null);
  }

  function closeSettings(fromPointer = false) {
    flushSync(() => setSettingsOpen(false));
    settingsButton.current?.focus({ preventScroll: true });
    setPointerFocus(fromPointer ? "settings" : null);
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
      <AdaptiveIsland
        view={settingsOpen ? "settings" : keyboardVisible ? "text" : "voice"}
        size={!settingsOpen && keyboardVisible ? "fill" : "content"}
        className={`${styles.composer} ${settingsOpen ? styles.settingsComposer : keyboardVisible ? "" : styles.compactComposer}`}
        aria-label={settingsOpen ? "Audio settings" : keyboardVisible ? "Chat input" : "Voice controls"}
        onKeyDown={(event) => {
          setPointerFocus(null);
          if (settingsOpen && event.key === "Escape") {
            event.preventDefault();
            closeSettings();
          }
        }}
        onSubmit={(event) => event.preventDefault()}
      >
        <IslandView active={!settingsOpen} className={`${styles.conversationView} ${keyboardVisible ? styles.expandedView : ""}`}>
          <motion.div initial={false} animate={{ opacity: keyboardVisible ? 1 : 0 }} transition={{ opacity: { duration: 0.18, delay: keyboardVisible ? 0.08 : 0 } }} className={styles.inputRow} hidden={!keyboardVisible}>
            {keyboardVisible && <motion.button className={styles.iconButton} type="button" aria-label="Add attachment" title="Attachments are not connected yet" disabled><Icon name="add" size={20} /></motion.button>}
            <div className={styles.inputArea} ref={inputArea} id="preview-chat-input">
              <SlashComposer kids={[]} skills={[]} draft={draft} onDraftChange={setDraft} placeholder="Message Homa…" />
            </div>
          </motion.div>
          <motion.div className={styles.modeSelector} role="group" aria-label="Conversation view">
            <motion.button type="button" className={styles.modeButton} aria-pressed={keyboardVisible} aria-controls="preview-chat-input" onClick={showKeyboard}>Text</motion.button>
            <motion.button type="button" className={styles.modeButton} aria-pressed={!keyboardVisible} ref={voiceButton} data-pointer-focus={pointerFocus === "voice"} onBlur={() => setPointerFocus(null)} onClick={(event) => {
              voiceButton.current?.focus({ preventScroll: true });
              setPointerFocus(event.detail > 0 ? "voice" : null);
              setKeyboardVisible(false);
            }}>Voice</motion.button>
            <motion.button className={styles.iconButton} type="button" aria-label="Settings" aria-controls="preview-audio-settings" aria-expanded={settingsOpen} ref={settingsButton} data-pointer-focus={pointerFocus === "settings"} onBlur={() => setPointerFocus(null)} onClick={(event) => openSettings(event.detail > 0)}><Icon name="settings" size={20} /></motion.button>
          </motion.div>
          <motion.div className={styles.composerActions} hidden={!keyboardVisible}>
            {keyboardVisible && <motion.button className={styles.iconButton} type="submit" aria-label="Send message" title="Sending is not connected yet" disabled><Icon name="send" size={20} /></motion.button>}
          </motion.div>
        </IslandView>
        <IslandView active={settingsOpen} className={styles.settingsView} id="preview-audio-settings">
          <motion.div className={styles.settingsControls}>
            <motion.button className={styles.iconButton} type="button" aria-label="Close audio settings" ref={backButton} data-pointer-focus={pointerFocus === "back"} onBlur={() => setPointerFocus(null)} onClick={(event) => closeSettings(event.detail > 0)}><Icon name="close" size={20} /></motion.button>
            <motion.button type="button" aria-pressed={microphoneOn} onClick={() => setMicrophoneOn((on) => !on)}>
              <Icon name={microphoneOn ? "voice" : "muted"} size={20} /><span>Mic</span>
            </motion.button>
            <motion.button type="button" aria-pressed={speakerOn} onClick={() => setSpeakerOn((on) => !on)}>
              <Icon name={speakerOn ? "volume" : "volume_muted"} size={20} /><span>Sound</span>
            </motion.button>
            <motion.button type="button" onClick={endVoice}>End voice</motion.button>
          </motion.div>
        </IslandView>
      </AdaptiveIsland>
    </div>
  );
}
