"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Icon } from "../../components/design/Icon";
import type { ArchivedMessage } from "../app/chat-storage";
import { ChecklistTakeover } from "../app/checklist-takeover";
import { SlashComposer } from "../app/slash-composer";
import { appendVoiceEffects, appendVoiceWork, voiceEffectMessageId, type VoiceEffectContext } from "../app/voice-effects";
import { VoiceEffectsView } from "../app/voice-effects-view";
import { VoiceMode, type VoiceModeHandle, type VoiceModePresentation } from "../app/voice-mode";
import { VoiceResultHandoff } from "../app/voice-result-handoff";
import type { VoiceTranscriptLine } from "../app/voice-transcript";
import { AdaptiveIsland, IslandView } from "./adaptive-island";
import type { App2Family } from "./voice-workspace-preview";
import styles from "./voice-workspace-preview.module.css";

function App2VoiceStatus({ connecting, ended, saving, saveFailed, isCapturing, microphoneOn, speakerOn, end, retrySave }: VoiceModePresentation) {
  return <div className={styles.voiceNotice} role="status">
    {connecting ? "Connecting voice…" : saving ? "Saving our conversation…" : isCapturing ? <>
      Voice connected
      <span role="img" aria-label={microphoneOn ? "Microphone active" : "Microphone muted"}><Icon name={microphoneOn ? "voice" : "muted"} size={16} /></span>
      <span role="img" aria-label={speakerOn ? "Sound on" : "Sound off"}><Icon name={speakerOn ? "volume" : "volume_muted"} size={16} /></span>
    </> : null}
    {ended && !saving && <button type="button" onClick={() => { void (saveFailed ? retrySave() : end()); }}>{saveFailed ? "Try saving again" : "Close voice"}</button>}
  </div>;
}

/** View selection and audio preferences remain independent of session lifetime. */
export function ConversationControlsPreview({ family }: { family: App2Family | null }) {
  const [pointerFocus, setPointerFocus] = useState<"voice" | "settings" | "back" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [voiceMounted, setVoiceMounted] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [turns, setTurns] = useState<VoiceTranscriptLine[]>([]);
  const [results, setResults] = useState<ArchivedMessage[]>([]);
  const [checklistChild, setChecklistChild] = useState<string | null>(null);
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const [generation, setGeneration] = useState(0);
  const generationRef = useRef(0);
  const handoff = useRef(new VoiceResultHandoff());
  const latestUser = useRef(new Map<string, number>());
  const [answerSource, setAnswerSource] = useState<VoiceEffectContext | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const voice = useRef<VoiceModeHandle>(null);
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
    setSettingsOpen(false);
    showKeyboard();
    void voice.current?.end();
  }

  function startVoice() {
    if (voiceMounted) return;
    if (!family) {
      setNotice("Open Homa to sign in or finish account setup, then reload this page.");
      return;
    }
    setNotice(null);
    setAnswerSource(null);
    generationRef.current += 1;
    setGeneration(generationRef.current);
    setVoiceMounted(true);
  }

  function sendMessage() {
    if (voice.current?.sendText(draft)) setDraft("");
  }

  return (
    <div className={styles.composerDock}>
      {voiceMounted && <VoiceMode
        key={generation}
        controlsRef={voice}
        microphoneOn={microphoneOn}
        speakerOn={speakerOn}
        onTurn={line => {
          setTurns(current => {
            const index = current.findIndex(turn => turn.sessionId === line.sessionId && turn.sequence === line.sequence);
            return index < 0 ? [...current, line] : current.map((turn, at) => at === index ? line : turn);
          });
          if (line.role === "user" && line.sessionId !== undefined && line.sequence !== undefined) {
            const sequence = line.sequence;
            latestUser.current.set(line.sessionId, Math.max(latestUser.current.get(line.sessionId) ?? -1, sequence));
            setAnswerSource(current => current !== null && current.sessionId === line.sessionId && sequence > current.sourceSequence ? null : current);
          }
        }}
        onClose={() => { if (generationRef.current === generation) { setVoiceMounted(false); setVoiceActive(false); } }}
        onActiveChange={active => { if (generationRef.current === generation) setVoiceActive(active); }}
        onNotice={message => { if (generationRef.current === generation) setNotice(message); }}
        onAnnouncementChange={say => { if (say) handoff.current.attach(generation, say); else handoff.current.detach(generation); }}
        onEffects={(output, context) => {
          setResults(current => appendVoiceEffects(current, output, context, Date.now()));
          setConversationOpen(true);
          handoff.current.complete(generation, context, output);
          if (generationRef.current === generation && (latestUser.current.get(context.sessionId) ?? -1) <= context.sourceSequence) setAnswerSource(context);
        }}
        onWorking={(busy, context) => {
          setWorking(current => ({ ...current, [voiceEffectMessageId(context)]: busy }));
          if (busy) { setResults(current => appendVoiceWork(current, context, Date.now())); setConversationOpen(true); }
        }}
        presentation={App2VoiceStatus}
      />}
      {Object.values(working).some(Boolean) && <p className={styles.voiceNotice} role="status">Homa is working on your request…</p>}
      {notice && <p className={styles.voiceNotice} role="status">{notice} {!family && <a href="/app" target="_blank" rel="noreferrer">Open Homa</a>}</p>}
      {(turns.length > 0 || results.length > 0) && <details className={styles.voiceConversation} open={conversationOpen} onToggle={event => setConversationOpen(event.currentTarget.open)}>
        <summary>Conversation</summary>
        <div className={styles.voiceConversationBody}>
          {turns.map((turn, index) => <p key={`${turn.sessionId}:${turn.sequence ?? index}`}><strong>{turn.role === "user" ? "You" : "Homa"}</strong><br />{turn.text}</p>)}
          {results.map(entry => <VoiceEffectsView
            key={entry.message.id} message={entry.message}
            working={working[entry.message.id] ?? false}
            voiceActive={voiceActive} currentRequest={voiceMounted && answerSource !== null && voiceEffectMessageId(answerSource) === entry.message.id} canAnswerOutLoud={voiceActive && microphoneOn && answerSource !== null && voiceEffectMessageId(answerSource) === entry.message.id}
            timeZone={family?.timeZone ?? "America/New_York"} familyId={family?.id ?? null}
            childNameById={new Map(family?.children.map(child => [child.id, child.name]) ?? [])}
            onOpenPlanner={() => window.open("/app/planner", "_blank", "noopener")}
            onOpenChecklist={setChecklistChild}
            onOpenReport={childId => window.open(`/app/${encodeURIComponent(childId)}/report`, "_blank", "noopener")}
          />)}
          {checklistChild && <ChecklistTakeover childId={checklistChild} onClose={() => setChecklistChild(null)} />}
        </div>
      </details>}
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
        onSubmit={(event) => { event.preventDefault(); sendMessage(); }}
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
              startVoice();
            }}>Voice</motion.button>
            <motion.button className={styles.iconButton} type="button" aria-label="Settings" aria-controls="preview-audio-settings" aria-expanded={settingsOpen} ref={settingsButton} data-pointer-focus={pointerFocus === "settings"} onBlur={() => setPointerFocus(null)} onClick={(event) => openSettings(event.detail > 0)}><Icon name="settings" size={20} /></motion.button>
          </motion.div>
          <motion.div className={styles.composerActions} hidden={!keyboardVisible}>
            {keyboardVisible && <motion.button className={styles.iconButton} type="submit" aria-label="Send message" title={voiceActive ? "Send to Homa" : "Start voice to send in this conversation"} disabled={!voiceActive || !draft.trim() || draft.length > 8000}><Icon name="send" size={20} /></motion.button>}
          </motion.div>
        </IslandView>
        <IslandView active={settingsOpen} className={styles.settingsView} id="preview-audio-settings">
          <motion.div className={styles.settingsControls}>
            <motion.button className={styles.iconButton} type="button" aria-label="Close audio settings" ref={backButton} data-pointer-focus={pointerFocus === "back"} onBlur={() => setPointerFocus(null)} onClick={(event) => closeSettings(event.detail > 0)}><Icon name="close" size={20} /></motion.button>
            <motion.button type="button" aria-pressed={voiceActive && microphoneOn} disabled={!voiceMounted} onClick={() => setMicrophoneOn((on) => !on)}>
              <Icon name={microphoneOn ? "voice" : "muted"} size={20} /><span>Mic</span>
            </motion.button>
            <motion.button type="button" aria-pressed={voiceActive && speakerOn} disabled={!voiceMounted} onClick={() => setSpeakerOn((on) => !on)}>
              <Icon name={speakerOn ? "volume" : "volume_muted"} size={20} /><span>Sound</span>
            </motion.button>
            <motion.button type="button" disabled={!voiceMounted} onClick={endVoice}>End voice</motion.button>
          </motion.div>
        </IslandView>
      </AdaptiveIsland>
    </div>
  );
}
