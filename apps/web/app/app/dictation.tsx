"use client";

import { Check, Mic, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ThinkingMark } from "../../components/brand/ThinkingMark";

/**
 * Voice input for the chat composer (PRD FR-4, backlog M0-04/M1-05
 * first slice): tap the mic, talk, tap the check, and the words land in
 * the draft to review and send. Dictation, not voice notes: the parent
 * always sees and can edit the text before anything sends, and the text
 * box stays the ever-present fallback (M1-05's law: voice failure must
 * never strand her).
 *
 * MediaRecorder over the Web Speech API on purpose: SpeechRecognition
 * is unreliable on iOS Safari and absent in Firefox, while MediaRecorder
 * works on every phone browser, and the recording transcribes through
 * the same Whisper backend the SMS voice-note lane already trusts
 * (POST /api/chat/dictation -> lib/voice/transcribe.ts).
 *
 * Split from chat-client.tsx so the recorder state machine (hardware,
 * timers, upload) stays in one place; the composer only wires phases to
 * layout. Fail-soft everywhere: a denied mic or an unclear clip becomes
 * a quiet hint under the composer, never a broken input.
 */

export type DictationPhase = "idle" | "recording" | "transcribing";

// Copy passed both gates 2026-07-10 (reader, then editor): typing is
// named as the path that always works, and the retry line offers both
// fixes because the server cannot tell too-quiet from too-noisy.
const MIC_FAILED_MESSAGE =
  "Homa couldn't use your microphone. Typing works just as well. To talk instead, allow the microphone in your phone or browser settings.";
const TRANSCRIBE_FAILED_MESSAGE =
  "Homa couldn't make that out. Try somewhere quieter, or speak closer to the microphone. Typing works too.";

/** Shown under the composer while the mic is live: answers the two
 *  fears the reader gate caught (how does this end, and does the check
 *  send my raw words). */
export const RECORDING_HINT_MESSAGE =
  "Tap the check when you're done. Nothing sends until you send it.";

/** Auto-accept long recordings: dictated prompts run seconds, not
 *  minutes, and the route caps uploads at 4MB. Three minutes stays
 *  under that cap even at iOS Safari's AAC bitrates (Opus browsers
 *  honor the 32kbps hint below and sit far under it). */
export const MAX_RECORDING_SECONDS = 180;

/**
 * Said when the cap ends a take, because until 2026-07-29 it ended it in
 * silence (gh#351).
 *
 * A parent dictated a long list of page-by-page edits, the cap stopped
 * her at three minutes, and the transcript was accepted mid-word: 1502
 * characters ending "...for Amalia to count. Fo". Nothing told her, and
 * the composer is one line, so the truncation was invisible until Homa
 * replied that the message had cut off. She then spent twenty minutes
 * trying to recover it with a screen recording and a screenshot.
 *
 * Names the limit, keeps her words, and points at the fix she can act on
 * rather than apologising.
 */
export const DICTATION_CUTOFF_MESSAGE =
  "Your first 3 minutes are safe in this message. Recording stopped at the 3-minute limit. You can send this message now. To add more, tap the microphone and start a new recording.";

export function recordingLimitNotice(input: {
  autoStopped: boolean;
  hasTranscript: boolean;
}): string | null {
  return input.autoStopped && input.hasTranscript
    ? DICTATION_CUTOFF_MESSAGE
    : null;
}

/** Chrome and Firefox record webm/opus; iOS Safari records mp4 (AAC).
 *  Both map onto the transcriber's extension allowlist. Returning
 *  undefined lets the browser pick its own default. */
function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Recording support never changes within a page's life, so the
 *  "store" is a constant read: false on the server (SSR markup shows
 *  no mic), the real capability after hydration. */
const noopSubscribe = () => () => {};
function readRecordingSupport(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function useDictation(onTranscript: (transcript: string) => void) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    readRecordingSupport,
    () => false,
  );
  const [phase, setPhase] = useState<DictationPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** True when the 3-minute cap ended the take rather than the parent. */
  const [autoStopped, setAutoStopped] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Synchronous double-tap guard: phase state lags a tap behind, and
  // two concurrent getUserMedia calls would leak a live mic stream.
  const startingRef = useRef(false);
  const autoStoppedRef = useRef(false);
  // Recorder callbacks outlive renders; the ref keeps them on the
  // freshest insert-into-draft closure.
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  // Unmount mid-recording: drop the take and release the hardware so
  // the browser's recording indicator never outlives the page.
  useEffect(() => {
    return () => {
      discardRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseHardware() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }

  async function finishRecording(mimeType: string) {
    const chunks = chunksRef.current;
    const discarded = discardRef.current;
    releaseHardware();
    if (discarded) return;

    const blob = new Blob(chunks, {
      type: mimeType.length > 0 ? mimeType : "audio/webm",
    });
    try {
      const form = new FormData();
      form.append("audio", blob, "dictation");
      const response = await fetch("/api/chat/dictation", {
        method: "POST",
        body: form,
      });
      const payload = response.ok
        ? ((await response.json()) as { transcript?: string | null })
        : null;
      const transcript = payload?.transcript?.trim() ?? "";
      const hasTranscript = transcript.length > 0;
      if (hasTranscript) onTranscriptRef.current(transcript);
      else setError(TRANSCRIBE_FAILED_MESSAGE);
      setAutoStopped(
        recordingLimitNotice({
          autoStopped: autoStoppedRef.current,
          hasTranscript,
        }) !== null,
      );
    } catch {
      setError(TRANSCRIBE_FAILED_MESSAGE);
      setAutoStopped(false);
    }
    autoStoppedRef.current = false;
    setPhase("idle");
  }

  async function start() {
    if (phase !== "idle" || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    // A new take is not still cut off; the notice must not outlive it.
    setAutoStopped(false);
    autoStoppedRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(MIC_FAILED_MESSAGE);
      startingRef.current = false;
      return;
    }

    const mimeType = pickRecorderMimeType();
    // 32kbps keeps speech clear for Whisper while holding minutes of
    // audio well under the upload cap; browsers may ignore the hint.
    const recorder = new MediaRecorder(stream, {
      audioBitsPerSecond: 32_000,
      ...(mimeType ? { mimeType } : {}),
    });
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    // recorder.mimeType is the negotiated truth (may add a codecs
    // suffix); the transcriber strips parameters before mapping it.
    recorder.onstop = () => {
      void finishRecording(recorder.mimeType);
    };

    recorder.start();
    setSeconds(0);
    setPhase("recording");
    startingRef.current = false;
    timerRef.current = setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);
  }

  function accept() {
    const recorder = recorderRef.current;
    if (!recorder || phase !== "recording") return;
    stopTimer();
    setPhase("transcribing");
    recorder.stop();
  }

  function clearCutoffNotice() {
    autoStoppedRef.current = false;
    setAutoStopped(false);
  }

  function cancel() {
    const recorder = recorderRef.current;
    stopTimer();
    discardRef.current = true;
    autoStoppedRef.current = false;
    setAutoStopped(false);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else releaseHardware();
    setPhase("idle");
  }

  // The cap lives in an effect (not the interval callback) so stopping
  // stays a plain state-driven action, never a setState side effect.
  useEffect(() => {
    if (phase !== "recording" || seconds < MAX_RECORDING_SECONDS) return;
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    autoStoppedRef.current = true;
    setPhase("transcribing");
    recorder.stop();
  }, [phase, seconds]);

  return {
    supported,
    phase,
    seconds,
    error,
    autoStopped,
    start,
    accept,
    cancel,
    clearCutoffNotice,
  };
}

export function MicButton({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      aria-label="Talk instead of typing"
      title="Talk instead of typing"
      onClick={onStart}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-page hover:text-strong"
    >
      <Mic size={20} aria-hidden="true" />
    </button>
  );
}

function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** The composer's recording state: replaces the text input while the
 *  mic is live (the Cowork-style listening row), then shows the
 *  writing-down beat while Whisper works. X drops the take; the check
 *  turns it into words she can still edit. */
export function DictationRow({
  phase,
  seconds,
  onCancel,
  onAccept,
}: {
  phase: DictationPhase;
  seconds: number;
  onCancel: () => void;
  onAccept: () => void;
}) {
  const transcribing = phase === "transcribing";
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-10 flex-1 items-center gap-3"
    >
      {transcribing ? (
        <>
          <ThinkingMark size={28} mood="working" />
          <span className="text-muted">Writing that down&hellip;</span>
        </>
      ) : (
        <>
          <span
            className="dictation-pulse h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
            aria-hidden="true"
          />
          <span className="text-muted">Listening&hellip;</span>
          <span className="text-sm tabular-nums text-subtle">
            {formatRecordingTime(seconds)}
          </span>
        </>
      )}
      <span className="flex-1" aria-hidden="true" />
      <button
        type="button"
        aria-label="Throw away what you said"
        onClick={onCancel}
        disabled={transcribing}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-brand disabled:opacity-60"
      >
        <X size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Add what you said to the message"
        onClick={onAccept}
        disabled={transcribing}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        <Check size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
