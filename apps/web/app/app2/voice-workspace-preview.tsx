"use client";

import { useEffect, useRef, useState } from "react";

import { Logo } from "../../components/brand/Logo";
import styles from "./voice-workspace-preview.module.css";

const states = [
  ["listening", "Listening", "Voice just started"],
  ["thinking", "Thinking", "Homa is preparing a reply"],
  ["speaking", "Speaking", "Homa answers"],
  ["working", "Working in the background", "You can keep talking"],
  ["ready", "Something is ready", "A result arrives"],
  ["paused", "Voice paused", "Microphone and audio off"],
  ["text", "Text only", "Keep the same conversation"],
  ["ended", "Conversation ended", "Start again when you want"],
] as const;

type PreviewState = (typeof states)[number][0];

export function VoiceWorkspacePreview() {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [current, setCurrent] = useState<{ name: PreviewState; speaking: boolean }>({
    name: "listening",
    speaking: false,
  });
  const stateDialog = useRef<HTMLDialogElement>(null);
  const worksheetDialog = useRef<HTMLDialogElement>(null);
  const stateButton = useRef<HTMLButtonElement>(null);
  const worksheetButton = useRef<HTMLButtonElement>(null);
  const state = current.name;

  useEffect(() => {
    if (!current.speaking) return;
    // The simulated speaking cue expires and is cancelled by a new state.
    const timer = window.setTimeout(() => {
      setCurrent({ name: current.name === "speaking" ? "listening" : current.name, speaking: false });
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [current]);

  const status = {
    listening: "",
    thinking: "Thinking",
    speaking: "Speaking",
    working: "",
    ready: current.speaking ? "Speaking" : "",
    paused: "Voice paused",
    text: "Text only",
    ended: "Voice ended",
  }[state];
  const utterance = state === "speaking"
    ? "What would make today a little easier?"
    : state === "ready" ? "Cleo’s worksheet is ready. Take a look." : "";

  return (
    <div className={styles.preview}>
      <header className={styles.toolbar}>
        <nav aria-label="Preview size">
          {(["desktop", "mobile"] as const).map((size) => (
            <button key={size} aria-pressed={view === size} onClick={() => setView(size)}>
              {size === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </nav>
        <span>Local design preview · no audio or model</span>
        <button ref={stateButton} onClick={() => stateDialog.current?.showModal()}>States</button>
      </header>
      <div className={styles.frame} data-view={view}>
        <main className={styles.screen} data-state={state}>
          <div className={styles.stage}>
            <section className={styles.identity} aria-label="Homa" data-speaking={current.speaking}>
              <div className={styles.character}>
                <Logo variant="mark" size={state === "text" ? 32 : 64} />
              </div>
              {status && <p className={styles.status} role="status">{status}</p>}
              {utterance && <p className={styles.utterance}>{utterance}</p>}
              {state === "text" && <p className={styles.status}>Microphone off. Replies stay on screen.</p>}
            </section>
            {(state === "working" || state === "ready") && (
              <section className={styles.card} aria-label="Worksheet task">
                <p className={styles.meta}>For Cleo</p>
                <h2>{state === "working" ? "Making your tracing sheet" : "Little m, big practice"}</h2>
                <p>{state === "working" ? "You can keep talking while I work." : "One page of lowercase m tracing."}</p>
                {state === "working" ? (
                  <div className={styles.progress}><i aria-hidden="true" />Building the page</div>
                ) : (
                  <button className={styles.primary} ref={worksheetButton} onClick={() => worksheetDialog.current?.showModal()}>Open worksheet</button>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
      <dialog className={styles.dialog} ref={stateDialog} aria-labelledby="state-title" onClose={() => stateButton.current?.focus()}>
        <div className={styles.dialogHeader}>
          <h2 id="state-title">Preview a state</h2>
          <button onClick={() => stateDialog.current?.close()}>Close</button>
        </div>
        <div className={styles.stateList}>
          {states.map(([name, label, description]) => (
            <button key={name} aria-pressed={state === name} onClick={() => {
              setCurrent({ name, speaking: name === "speaking" || name === "ready" });
              stateDialog.current?.close();
            }}>
              {label}<small>{description}</small>
            </button>
          ))}
        </div>
        <p className={styles.note}>Design preview only. No microphone, audio, model, or family data is connected.</p>
      </dialog>
      <dialog className={styles.dialog} ref={worksheetDialog} aria-labelledby="worksheet-title" onClose={() => worksheetButton.current?.focus()}>
        <div className={styles.dialogHeader}>
          <h2 id="worksheet-title">Sample worksheet</h2>
          <button onClick={() => worksheetDialog.current?.close()}>Close</button>
        </div>
        <div className={styles.paper}>
          <p>For Cleo · fictional sample</p>
          <h3>Little m,<br />big practice.</h3>
          <p>Trace each m. Take your time.</p>
          {[0, 1, 2].map((row) => <div className={styles.tracing} key={row}>m m m</div>)}
        </div>
      </dialog>
    </div>
  );
}
