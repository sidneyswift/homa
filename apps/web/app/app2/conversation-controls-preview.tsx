"use client";

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { archiveFromServerHistory, type ChatHistoryPayload } from "../../lib/chat-history-model";
import type { EveMessage } from "eve/client";
import type { ConversationFeedMessage, ConversationFeedQuestion } from "../../lib/conversation-feed";
import { renderQuestionAnswer, type ConversationQuestionAnswer } from "../../lib/conversation-question-answer";
import type { PendingConversationIntent } from "./conversation-outbox";
import { readStagedConversationFiles } from "./conversation-file-staging";
import { queueConversationIntent } from "./conversation-local-store";
import { useConversationFeed } from "./use-conversation-feed";
import { usePermanentConversationDelivery } from "./use-permanent-conversation";
import { NativeConversationCard, type NativeConversationBatch } from "./native-conversation-card";
import type { NativeInputResponse } from "../../lib/conversation-native-input";
import { PermanentQuestionCard } from "./permanent-question-card";
import { useConversationDraft } from "./use-conversation-draft";
import { Icon } from "../../components/design/Icon";
import { AttachMenuButton, PendingAttachmentChips, useChatAttachments } from "../app/chat-attachments";
import { composerPrimaryAction } from "../app/chat-send-policy";
import { MessageView } from "../app/message-parts";
import { useWorkspaceChat } from "./use-workspace-chat";
import { submitWorkspaceDraft } from "./workspace-send";
import { durableWorkspaceActivity, workspaceActivity } from "./workspace-activity";
import { WorkspaceActivity } from "./workspace-activity-view";
import type { ArchivedMessage } from "../app/chat-storage";
import { ChecklistTakeover } from "../app/checklist-takeover";
import { SlashComposer } from "../app/slash-composer";
import { appendVoiceEffects, appendVoiceWork, voiceEffectMessageId, type VoiceEffectContext } from "../app/voice-effects";
import { VoiceEffectsView } from "../app/voice-effects-view";
import { VoiceMode, type VoiceModeHandle, type VoiceModePresentation } from "../app/voice-mode";
import { VoiceResultHandoff } from "../app/voice-result-handoff";
import { spokenTurnMessage, type VoiceTranscriptLine } from "../app/voice-transcript";
import { AdaptiveIsland, IslandView } from "./adaptive-island";
import type { App2Family } from "./voice-workspace-preview";
import styles from "./voice-workspace-preview.module.css";

function App2VoiceStatus({ connecting, ended, saving, saveFailed, end, retrySave }: VoiceModePresentation) {
  if (!saving && !saveFailed && !ended) {
    return <span className="sr-only" role="status">{connecting ? "Connecting voice…" : ""}</span>;
  }
  return <div className={styles.voiceNotice} role="status">
    {saving ? "Saving our conversation…" : null}
    {saveFailed && <span>Some of this conversation has not saved. Keep Homa open and try saving again.</span>}
    {(ended || saveFailed) && <button type="button" disabled={saving} onClick={() => { void (saveFailed ? retrySave() : end()); }}>{saving ? "Saving…" : saveFailed ? "Try saving again" : "Close voice"}</button>}
  </div>;
}

function FeedQuestion({ question, onAnswer, onTypeReply }: { question: ConversationFeedQuestion;
  onAnswer(answer: ConversationQuestionAnswer): Promise<boolean>; onTypeReply(id: string): void }) {
  return <PermanentQuestionCard key={question.id} {...question} onAnswer={onAnswer} onTypeInstead={() => onTypeReply(question.id)} />;
}

function FeedNativeQuestion({ batch, pending, failed, epoch, onAnswer }: {
  batch: NativeConversationBatch; pending: PendingConversationIntent[]; failed: PendingConversationIntent[]; epoch: string | null;
  onAnswer(batch: NativeConversationBatch, responses: NativeInputResponse[]): Promise<boolean>;
}) {
  const rejected = failed.filter(entry => entry.nativeInput?.batchId === batch.batchId);
  return <NativeConversationCard key={`${epoch}:${batch.batchId}:${rejected.map(entry => entry.intentId).sort().join(":")}`}
    batch={batch} queued={pending.find(entry => entry.nativeInput?.batchId === batch.batchId)?.nativeInput?.responses ?? null}
    failed={rejected.length > 0} onAnswer={responses => onAnswer(batch, responses)} />;
}

/** History and partial revisions remain manually readable. Only a new finished
 * answer is announced, once, and never over active voice playback. */
function ConversationAnnouncement({ messages, ready, speaking, readingHistory }: {
  messages: ConversationFeedMessage[]; ready: boolean; speaking: boolean; readingHistory: boolean;
}) {
  const known = useRef(new Set<string>());
  const initialized = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    let active = true;
    const publish = (text: string) => queueMicrotask(() => { if (active) setAnnouncement(text); });
    if (!ready) {
      known.current.clear(); initialized.current = false; publish("");
      return () => { active = false; };
    }
    const completed = messages.filter(row => row.role === "assistant" && row.responseComplete);
    const fresh = completed.filter(row => !known.current.has(row.id));
    // Mark old pages and replies heard through voice as known while suppressed.
    // Returning to the newest view must not read those historical rows aloud.
    completed.forEach(row => known.current.add(row.id));
    if (!initialized.current) { initialized.current = true; publish(""); }
    else if (speaking || readingHistory) publish("");
    else if (fresh.length) publish(fresh.map(row => row.content).join("\n"));
    return () => { active = false; };
  }, [messages, ready, speaking, readingHistory]);
  return <span className="sr-only" role="status" aria-live={!ready || speaking || readingHistory ? "off" : "polite"} aria-atomic="true">{ready && !speaking && !readingHistory ? announcement : ""}</span>;
}

/** View selection and audio preferences remain independent of session lifetime. */
type ConversationControlsProps = { durableConversation?: boolean; family: App2Family | null; userId: string | null;
  history: ChatHistoryPayload | null; workspaceEngaged: boolean; onEngagedChange: (engaged: boolean) => void };
export function ConversationControlsPreview(props: ConversationControlsProps) {
  return <ConversationControlsSession key={`${props.family?.id ?? ""}:${props.userId ?? ""}`} {...props} />;
}
function ConversationControlsSession({ family, userId, history, workspaceEngaged, onEngagedChange, durableConversation = false }: ConversationControlsProps) {
  const [pointerFocus, setPointerFocus] = useState<"voice" | "settings" | "back" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const account = family && userId ? `${family.id}:${userId}` : null;
  const delivery = usePermanentConversationDelivery(account, durableConversation);
  const { draft, setDraft, draftError, draftRevision, queueDraft, replyToQuestionId, setReplyToQuestionId, clearReplyToQuestion } = useConversationDraft(delivery.signedOut ? null : account);
  const feed = useConversationFeed(delivery.signedOut ? null : account, durableConversation, delivery.revision);
  const nativeBatches = useMemo(() => feed.messages.flatMap(message => message.nativeInput ? [message.nativeInput] : []), [feed.messages]);
  const confirmVisibleIntents = delivery.confirmVisibleIntents;
  useEffect(() => {
    confirmVisibleIntents(feed.messages.flatMap(row => row.request ? [row.request.intentId] : []), feed.accessEpoch);
  }, [feed.messages, feed.accessEpoch, confirmVisibleIntents]);
  const enqueueing = useRef(false);
  const recoveryView = useRef({ active: true, draftRevision, signedOut: delivery.signedOut });
  useLayoutEffect(() => {
    recoveryView.current = { active: true, draftRevision, signedOut: delivery.signedOut };
    return () => { recoveryView.current.active = false; };
  }, [draftRevision, delivery.signedOut]);
  const attachments = useChatAttachments(family?.id ?? null, { durableAccount: durableConversation && !delivery.signedOut ? account : null });
  const chat = useWorkspaceChat();
  const archived = useMemo(() => !durableConversation && history ? archiveFromServerHistory(history, chat.messages, chat.sessionId) : [], [history, chat.messages, chat.sessionId, durableConversation]);
  const durableMaterials = useMemo(() => archiveFromServerHistory({ messages: [], materials: feed.materials }, []), [feed.materials]);
  const durableMessages = useMemo(() => feed.messages.map(row => ({ id: row.id, role: row.role,
    parts: [{ type: "text", text: row.content }] }) as EveMessage), [feed.messages]);
  const textMessages = useMemo(() => durableConversation ? durableMessages : [...archived.map(entry => entry.message), ...chat.messages], [archived, chat.messages, durableConversation, durableMessages]);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [voiceMounted, setVoiceMounted] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceStopping, setVoiceStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [turnTimes, setTurnTimes] = useState<Record<string, number>>({});
  const [turns, setTurns] = useState<VoiceTranscriptLine[]>([]);
  const [results, setResults] = useState<ArchivedMessage[]>([]);
  const [checklistChild, setChecklistChild] = useState<string | null>(null);
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const [generation, setGeneration] = useState(0);
  const generationRef = useRef(0);
  const handoff = useRef(new VoiceResultHandoff());
  const latestUser = useRef(new Map<string, number>());
  const [answerSource, setAnswerSource] = useState<VoiceEffectContext | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const previousTurns = useRef(turns);
  const voice = useRef<VoiceModeHandle>(null);
  const inputArea = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!delivery.signedOut) return;
    generationRef.current += 1;
    latestUser.current.clear();
    handoff.current = new VoiceResultHandoff();
    queueMicrotask(() => {
      setVoiceMounted(false); setVoiceActive(false); setVoiceConnecting(false); setVoiceStopping(false);
      setTurns([]); setTurnTimes({}); setResults([]); setWorking({}); setAnswerSource(null); setChecklistChild(null);
    });
  }, [delivery.signedOut]);

  const timeline = useMemo(() => [
    ...durableMaterials.map(entry => ({ kind: "text" as const, key: entry.message.id, at: entry.at, message: entry.message })),
    ...feed.messages.map((row, index) => ({ kind: "text" as const, key: row.id, at: row.atMs, message: durableMessages[index] })),
    ...delivery.pending.filter(entry => !feed.messages.some(row => row.request?.intentId === entry.intentId)).map(entry => ({ kind: "text" as const,
      key: `pending:${entry.intentId}`, at: entry.submittedAt, message: { id: entry.intentId, role: "user", parts: [{ type: "text", text: entry.text }] } as EveMessage })),
    ...archived.map(entry => ({ kind: "text" as const, key: entry.message.id, at: entry.at, message: entry.message })),
    ...chat.messages.map(message => ({ kind: "text" as const, key: `${chat.sessionId}:${message.id}`, at: chat.messageTimes[message.id] ?? Number.MAX_SAFE_INTEGER, message })),
    ...turns.map((line, index) => {
      const message = spokenTurnMessage(line, index);
      return { kind: "voice" as const, key: message.id, at: turnTimes[`${line.sessionId}:${line.sequence}:${line.role}`] ?? 0, message };
    }),
    ...results.map(entry => ({ kind: "result" as const, key: entry.message.id, at: entry.at ?? 0, message: entry.message })),
  ].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key)), [archived, chat.messages, chat.messageTimes, chat.sessionId, turns, turnTimes, results, feed.messages, durableMessages, delivery.pending, durableMaterials]);

  const activity = durableConversation
    ? durableWorkspaceActivity({ messages: feed.messages, requests: feed.requests, pending: delivery.pending, unavailable: delivery.signedOut || !!delivery.error })
    : workspaceActivity(chat);
  const engaged = voiceMounted || timeline.length > 0 || activity !== null;
  useLayoutEffect(() => { onEngagedChange(engaged); }, [engaged, onEngagedChange]);

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

  function endVoice() {
    if (voiceStopping) return;
    setVoiceStopping(true);
    flushSync(() => setSettingsOpen(false));
    void voice.current?.end();
  }

  function startVoice() {
    if (voiceMounted || delivery.signedOut) return;
    if (!family) {
      setNotice("Open Homa to sign in or finish account setup, then reload this page.");
      return;
    }
    setNotice(null);
    setVoiceStopping(false);
    setMicrophoneOn(true);
    setAnswerSource(null);
    generationRef.current += 1;
    setGeneration(generationRef.current);
    setVoiceConnecting(true);
    setVoiceMounted(true);
  }

  useLayoutEffect(() => {
    const element = transcript.current;
    if (element && followLatest.current) {
      const latest = element.querySelector<HTMLElement>('[data-current="true"]');
      element.scrollTop = previousTurns.current !== turns && latest
        ? Math.max(0, latest.offsetTop + latest.offsetHeight + parseFloat(getComputedStyle(element).paddingBottom) - element.clientHeight)
        : element.scrollHeight;
    }
    previousTurns.current = turns;
  }, [turns, results, textMessages, workspaceEngaged, timeline, activity?.label]);

  const hasDraft = composerPrimaryAction({ draft, readyAttachments: attachments.staged.length }) === "send";
  const micLabel = !voiceMounted ? "Start voice" : voiceStopping ? "Stopping voice" : "Stop voice";

  async function sendMessage() {
    if (enqueueing.current || delivery.signedOut || !family || !hasDraft || (!durableConversation && draft.length > 8000) || chat.busy || attachments.anyUploading || attachments.staged.some(file => file.status !== "ready")) return;
    if (durableConversation) {
      if (!account || !delivery.accessEpoch) { setNotice("The conversation is reconnecting. Your draft is still here."); return; }
      if (enqueueing.current || attachments.staged.some(file => file.status !== "ready")) return;
      enqueueing.current = true;
      const submittedDraft = draft;
      const submittedRevision = draftRevision;
      const submittedFiles = [...attachments.staged];
      try {
        await queueDraft({ account, accessEpoch: delivery.accessEpoch, intentId: crypto.randomUUID(), text: submittedDraft,
          stagedAttachmentIds: submittedFiles.map(file => file.localId), submittedAt: Date.now() }, submittedRevision);
        delivery.notifyQueued(); setNotice(null);
        attachments.clear();
      } catch { setNotice("Your message could not be queued. Your text and files are still here."); }
      finally { enqueueing.current = false; }
      return;
    }
    const sentDraft = draft;
    const sentFiles = [...attachments.staged];
    enqueueing.current = true;
    try {
      if (await submitWorkspaceDraft({ text: sentDraft, setDraft, send: () => chat.send(sentDraft, sentFiles, turns) })) {
        for (const file of sentFiles) attachments.remove(file.localId);
      }
    } finally {
      enqueueing.current = false;
    }
  }

  function typeReplyToQuestion(questionId: string) {
    setReplyToQuestionId(questionId);
    inputArea.current?.querySelector<HTMLElement>("textarea,input,[contenteditable=true]")?.focus();
  }

  async function reuseFailedMessage(entry: PendingConversationIntent) {
    if (entry.nativeInput || draft || attachments.staged.length || account !== entry.account || delivery.signedOut) return;
    try {
      const revision = draftRevision;
      const files = await readStagedConversationFiles(entry.account, false);
      if (!recoveryView.current.active || recoveryView.current.signedOut || recoveryView.current.draftRevision !== revision) return;
      const selected = (entry.stagedAttachmentIds ?? []).map(id => files.find(file => file.id === id));
      if (selected.some(file => !file)) { setNotice("Some files are no longer on this device. Choose them again before sending."); }
      attachments.addFiles(selected.flatMap(file => file ? [new File([file.bytes], file.name, { type: file.mediaType })] : []));
      setDraft(entry.text); setReplyToQuestionId(entry.replyToQuestionId ?? null);
      inputArea.current?.querySelector<HTMLElement>("textarea,input,[contenteditable=true]")?.focus();
    } catch { setNotice("Your message is still here. Copy it below and choose any files again."); }
  }

  async function answerNative(batch: NativeConversationBatch, responses: NativeInputResponse[]) {
    if (!account || !delivery.accessEpoch || delivery.signedOut || batch.state !== "pending") return false;
    const text = responses.map(response => {
      const question = batch.requests.find(row => row.requestId === response.requestId);
      return response.text ?? question?.options?.find(option => option.id === response.optionId)?.label ?? "";
    }).join("\n");
    try {
      await queueConversationIntent({ account, accessEpoch: delivery.accessEpoch, intentId: crypto.randomUUID(),
        text, nativeInput: { batchId: batch.batchId, responses }, submittedAt: Date.now() });
      delivery.notifyQueued(); return true;
    } catch { setNotice("Your response could not be sent. Please try again."); return false; }
  }

  async function answerQuestion(answer: ConversationQuestionAnswer) {
    const question = feed.messages.find(row => row.question?.id === answer.questionId)?.question;
    if (!account || !delivery.accessEpoch || !question) return false;
    try {
      await queueConversationIntent({ account, accessEpoch: delivery.accessEpoch, intentId: crypto.randomUUID(),
        text: renderQuestionAnswer(question.card, answer), questionAnswer: answer, submittedAt: Date.now() });
      delivery.notifyQueued(); return true;
    } catch { setNotice("Your choices could not be sent. Please try again."); return false; }
  }

  return (
    <div className={styles.composerDock}>
      {voiceMounted && !delivery.signedOut && <VoiceMode
        key={generation}
        localApp2
        controlsRef={voice}
        microphoneOn={microphoneOn}
        speakerOn={speakerOn}
        onTurn={line => {
          const identity = `${line.sessionId}:${line.sequence}:${line.role}`;
          const at = Date.now();
          setTurnTimes(current => identity in current ? current : { ...current, [identity]: at });
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
        onClose={() => { if (generationRef.current === generation) { setVoiceMounted(false); setVoiceActive(false); setVoiceConnecting(false); setVoiceStopping(false); } }}
        onConnectingChange={setVoiceConnecting}
        onActiveChange={active => { if (generationRef.current === generation) setVoiceActive(active); }}
        onNotice={message => { if (generationRef.current === generation) setNotice(message); }}
        onAnnouncementChange={say => { if (say) handoff.current.attach(generation, say); else handoff.current.detach(generation); }}
        onEffects={(output, context) => {
          setResults(current => appendVoiceEffects(current, output, context, Date.now()));
          handoff.current.complete(generation, context, output);
          if (generationRef.current === generation && (latestUser.current.get(context.sessionId) ?? -1) <= context.sourceSequence) setAnswerSource(context);
        }}
        onWorking={(busy, context) => {
          setWorking(current => ({ ...current, [voiceEffectMessageId(context)]: busy }));
          if (busy) { setResults(current => appendVoiceWork(current, context, Date.now())); }
        }}
        presentation={App2VoiceStatus}
      />}
      {Object.values(working).some(Boolean) && <p className={styles.voiceNotice} role="status">Homa is working on your request…</p>}
      {notice && <p className={styles.voiceNotice} role="status">{notice} {!family && <a href="/app" target="_blank" rel="noreferrer">Open Homa</a>}</p>}
      {attachments.error && <p className={styles.voiceNotice} role="alert">{attachments.error}</p>}
      {draftError && <p className={styles.voiceNotice} role="alert">{draftError}</p>}
      {family && !history && !durableConversation && <p className={styles.voiceNotice} role="alert">Your earlier conversation could not load. Your history has not been deleted.</p>}
      {durableConversation && (delivery.error || feed.error) && <p className={styles.voiceNotice} role="alert">{delivery.error || feed.error}</p>}
      {durableConversation && !delivery.signedOut && delivery.failed.filter(entry => !entry.nativeInput ||
        (!nativeBatches.some(batch => batch.batchId === entry.nativeInput?.batchId && batch.state === "answered") &&
        !delivery.pending.some(pending => pending.nativeInput?.batchId === entry.nativeInput?.batchId))).map(entry => <section key={entry.intentId} aria-label="Message not sent" className={styles.voiceNotice}>
        <p>Not sent</p><p>{entry.text}</p>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(entry.text).catch(() => setNotice("Select the message text to copy it.")); }}>Copy message</button>
        {entry.nativeInput ? <p>Choose again in Homa’s question.</p> : <button type="button" disabled={Boolean(draft) || attachments.staged.length > 0} onClick={() => { void reuseFailedMessage(entry); }}>Use as draft</button>}
      </section>)}
      {durableConversation && <ConversationAnnouncement key={feed.accessEpoch} messages={feed.messages} ready={feed.accountActive} speaking={speakerOn && voiceActive} readingHistory={!feed.followingNewest || feed.hasNewer} />}
      {durableConversation && feed.materialsUnavailable && <p className={styles.voiceNotice} role="status">Your messages are here. Their files are still loading.</p>}
      {durableConversation && feed.requests.some(request => request.state === "recovery_required") && <p className={styles.voiceNotice} role="status">This request stopped before Homa could confirm the result. Your message is recorded.</p>}
      {chat.error && <p className={styles.voiceNotice} role="alert">{chat.error} <a href="/app" target="_blank" rel="noreferrer">Open conversation</a></p>}
      {durableConversation && feed.messages.some(message => message.nativeUnavailable) && <p className={styles.voiceNotice} role="status">Homa’s questions could not refresh. Trying again shortly.</p>}
      {!delivery.signedOut && (timeline.length > 0 || activity !== null) && <section className={styles.voiceConversation} aria-label="Conversation">
        <div className={styles.voiceConversationBody} ref={transcript} role="log" aria-label="Conversation transcript" aria-live={durableConversation || (speakerOn && voiceActive) ? "off" : "polite"} aria-relevant="additions text" tabIndex={0} onScroll={event => {
          const element = event.currentTarget;
          const latest = element.querySelector<HTMLElement>('[data-current="true"]');
          const bottom = element.scrollHeight - element.clientHeight;
          const speechTarget = latest ? Math.min(bottom, Math.max(0, latest.offsetTop + latest.offsetHeight + parseFloat(getComputedStyle(element).paddingBottom) - element.clientHeight)) : bottom;
          followLatest.current = bottom - element.scrollTop < 48 || (!durableConversation && Math.abs(speechTarget - element.scrollTop) < 48);
          if (durableConversation) feed.setFollowingNewest(followLatest.current);
        }}>
          <div className={styles.spokenTurns}>
            {durableConversation && feed.hasOlder && <button type="button" disabled={feed.loading || feed.loadingOlder} onClick={() => {
              const element = transcript.current;
              const anchor = element?.querySelector<HTMLElement>("[data-message-id]");
              const anchorId = anchor?.dataset.messageId;
              const offset = anchor && element ? anchor.getBoundingClientRect().top - element.getBoundingClientRect().top : 0;
              followLatest.current = false;
              feed.setFollowingNewest(false);
              void feed.loadOlder().then(() => requestAnimationFrame(() => {
                if (!element || !anchorId) return;
                const restored = Array.from(element.querySelectorAll<HTMLElement>("[data-message-id]")).find(node => node.dataset.messageId === anchorId);
                if (restored) element.scrollTop += restored.getBoundingClientRect().top - element.getBoundingClientRect().top - offset;
              }));
            }}>Earlier messages</button>}
            {timeline.map((entry, index) => <div className={styles.spokenTurn} data-message-id={entry.key} data-speaker={entry.message.role} data-current={index === timeline.length - 1} key={entry.key}>
              {durableConversation && feed.messages.find(row => row.id === entry.key)?.attachments?.map(file =>
                <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.name || file.caption || "Attached file"}</a>)}
              <span className="sr-only">{entry.message.role === "user" ? "You" : "Homa"}</span>
              {durableConversation && feed.messages.find(row => row.id === entry.key)?.nativeInput ? <FeedNativeQuestion
                batch={feed.messages.find(row => row.id === entry.key)!.nativeInput!} pending={delivery.pending} failed={delivery.failed}
                epoch={feed.accessEpoch} onAnswer={answerNative} /> : durableConversation && feed.messages.find(row => row.id === entry.key)?.question ? <FeedQuestion
                question={feed.messages.find(row => row.id === entry.key)!.question!} onAnswer={answerQuestion} onTypeReply={typeReplyToQuestion} /> : entry.kind === "result" ? <VoiceEffectsView
                message={entry.message} working={working[entry.message.id] ?? false}
                voiceActive={voiceActive} currentRequest={voiceMounted && answerSource !== null && voiceEffectMessageId(answerSource) === entry.message.id}
                canAnswerOutLoud={voiceActive && microphoneOn && answerSource !== null && voiceEffectMessageId(answerSource) === entry.message.id}
                timeZone={family?.timeZone ?? "America/New_York"} familyId={family?.id ?? null}
                childNameById={new Map(family?.children.map(child => [child.id, child.name]) ?? [])}
                onOpenPlanner={() => window.open("/app/planner", "_blank", "noopener")}
                onOpenChecklist={setChecklistChild}
                onOpenReport={childId => window.open(`/app/${encodeURIComponent(childId)}/report`, "_blank", "noopener")}
              /> : entry.kind === "voice" ? <p>{entry.message.parts.map(part => part.type === "text" ? part.text : "").join("").trimStart()}</p> : <MessageView
                showSendingStatus={false}
                message={entry.message} attachmentReceipts={entry.message.role === "user" ? chat.receiptsBySummary[entry.message.parts.map(part => part.type === "text" ? part.text : "").join("")] : undefined}
                familyId={family?.id ?? null} timeZone={family?.timeZone ?? "America/New_York"}
                childNameById={new Map(family?.children.map(child => [child.id, child.name]) ?? [])}
                onSendSuggestion={setDraft} onSendQuestionAnswers={setDraft}
                onOpenPlanner={() => window.open("/app/planner", "_blank", "noopener")}
                onOpenChecklist={setChecklistChild}
                onOpenReport={childId => window.open(`/app/${encodeURIComponent(childId)}/report`, "_blank", "noopener")}
              />}
            </div>)}
            {activity && <WorkspaceActivity activity={activity} speaking={speakerOn && voiceActive} />}
          </div>
          {checklistChild && <ChecklistTakeover childId={checklistChild} onClose={() => setChecklistChild(null)} />}
        </div>
      </section>}
      {durableConversation && (!feed.followingNewest || feed.hasNewer) && <button type="button" className={styles.voiceNotice} onClick={() => {
        void feed.jumpToNewest().then(() => {
          followLatest.current = true;
          requestAnimationFrame(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; });
        });
      }}>Newest messages</button>}
      <div className={styles.islandFootprint}>
      <div className={styles.islandPosition}>
      {durableConversation && replyToQuestionId && <div className={styles.voiceNotice}>
        Replying to Homa’s question <button type="button" onClick={clearReplyToQuestion}>Cancel reply</button>
      </div>}
      {attachments.staged.length > 0 && <div className={styles.pendingAttachments} aria-label="Attachments" aria-busy={attachments.anyUploading} inert={chat.busy}>
        <PendingAttachmentChips staged={attachments.staged} onRemove={attachments.remove} />
      </div>}
      <AdaptiveIsland
        view={settingsOpen ? "settings" : "text"}
        size={settingsOpen ? "content" : "fill"}
        className={`${styles.composer} ${settingsOpen ? styles.settingsComposer : ""}`}
        aria-label={settingsOpen ? "Audio settings" : "Chat input"}
        onKeyDown={(event) => {
          setPointerFocus(null);
          if (settingsOpen && event.key === "Escape") {
            event.preventDefault();
            closeSettings();
          }
        }}
        onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}
      >
        <IslandView active={!settingsOpen} className={`${styles.conversationView} ${styles.expandedView}`}>
          <div className={styles.inputRow}>
            <AttachMenuButton portal className={styles.iconButton} onFiles={attachments.addFiles} disabled={!family || chat.busy} />
            <div className={styles.inputArea} ref={inputArea} id="preview-chat-input">
              <SlashComposer kids={[]} skills={[]} draft={draft} onDraftChange={setDraft} placeholder={voiceConnecting && !voiceStopping ? "Connecting voice…" : "Message Homa…"} />
            </div>
          </div>
          <div className={styles.modeSelector} hidden>
            <motion.button className={styles.iconButton} type="button" aria-label="Settings" aria-controls="preview-audio-settings" aria-expanded={settingsOpen} ref={settingsButton} data-pointer-focus={pointerFocus === "settings"} onBlur={() => setPointerFocus(null)} onClick={(event) => openSettings(event.detail > 0)}><Icon name="settings" size={20} /></motion.button>
          </div>
          <div className={styles.composerActions}>
            {hasDraft && voiceMounted && <button className={styles.iconButton} type="button" aria-label={micLabel} title={micLabel} disabled={voiceStopping} onClick={endVoice}>
              <Icon name="stop" size={20} fill="currentColor" />
            </button>}
            <button className={styles.iconButton} type={hasDraft ? "submit" : "button"}
              aria-label={hasDraft ? "Send message" : micLabel}
              title={hasDraft ? "Send to Homa" : micLabel}
              disabled={hasDraft ? chat.busy || !family || delivery.signedOut || attachments.anyUploading || attachments.staged.some(file => file.status === "failed") || (!durableConversation && draft.length > 8000) : voiceStopping}
              data-pointer-focus={pointerFocus === "voice"} onBlur={() => setPointerFocus(null)}
              onClick={event => {
                if (hasDraft) return;
                setPointerFocus(event.detail > 0 ? "voice" : null);
                if (voiceMounted) endVoice();
                else startVoice();
              }}>
              <Icon name={hasDraft ? "send" : voiceMounted ? "stop" : "voice"} size={20} fill={!hasDraft && voiceMounted ? "currentColor" : "none"} />
            </button>
          </div>
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
      </div>
    </div>
  );
}
