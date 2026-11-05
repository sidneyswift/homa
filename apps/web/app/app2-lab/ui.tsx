"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { activitySchema, allocateMinutes, buildActivityDocument, initialInteraction, interactionSchema, planSchema, savedSchema, type Experiment, type Interaction } from "./contract";
import styles from "./ui.module.css";

const examples = {
  plan: "We have 30 minutes today. Create a hands-on plan for an example learner practicing counting to 20. Use household objects, include a movement break, and keep preparation under two minutes.",
  activity: "Create an interactive fractions activity for an example learner who understands halves and is exploring thirds. Let us change the number of equal pieces and shade them. Show the fraction and explain what changes. Include a small challenge with accurate feedback.",
};

type Saved = ReturnType<typeof savedSchema.parse>;
function decodeSaved(value: unknown): { experiment: Experiment; interaction: Interaction; prompt: string } {
  const data = savedSchema.parse(value);
  const experiment: Experiment = data.mode === "plan" ? { id: data.id, mode: "plan", result: planSchema.parse(data.result) } : { id: data.id, mode: "activity", result: activitySchema.parse(data.result) };
  return { experiment, interaction: data.interaction, prompt: data.prompt };
}

function ActivityFrame({ experiment, state, onState }: { experiment: Extract<Experiment, { mode: "activity" }>; state: Interaction["activity"]; onState: (state: Interaction["activity"]) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => crypto.randomUUID());
  const [document] = useState(() => buildActivityDocument(experiment.result.html, channel, state));
  const current = useRef(state);
  const callback = useRef(onState);
  useEffect(() => { current.current = state; callback.current = onState; }, [state, onState]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== channel) return;
      if (event.data.type === "ready") frame.current?.contentWindow?.postMessage({ channel, type: "restore", state: current.current }, "*");
      if (event.data.type === "error") setFailed(true);
      if (event.data.type === "state") {
        const parsed = interactionSchema.shape.activity.safeParse(event.data.state);
        if (parsed.success && JSON.stringify(parsed.data).length < 12000 && Object.keys(parsed.data).length <= 50) callback.current(parsed.data);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [channel]);
  return <><iframe ref={frame} className={styles.frame} title={experiment.result.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document} />{failed && <p role="alert">This activity reported an error. Ask for a simpler version below.</p>}</>;
}

export function GenerativeLab({ account }: { account: string }) {
  const [mode, setMode] = useState<"plan" | "activity">("plan");
  const [prompt, setPrompt] = useState(examples.plan);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [interaction, setInteraction] = useState(initialInteraction);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ title?: string; introduction?: string; activities?: { title?: string; instructions?: string }[] }>({});
  const [metrics, setMetrics] = useState<{ first: number | null; complete: number | null }>({ first: null, complete: null });
  const [saved, setSaved] = useState<Saved[]>([]);
  const [experimentPrompt, setExperimentPrompt] = useState("");
  const [renderEpoch, setRenderEpoch] = useState(0);
  const [revision, setRevision] = useState("");
  const abort = useRef<AbortController | null>(null);
  const storageKey = `app2-ui-lab:v1:${account}`;
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
    if (cancelled) return;
    try {
      const values = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(values)) setSaved(values.slice(0, 8).flatMap(v => { try { decodeSaved(v); return [savedSchema.parse(v)]; } catch { return []; } }));
    } catch { setStatus("Local drafts could not be loaded."); }
    });
    return () => { cancelled = true; abort.current?.abort(); };
  }, [storageKey]);

  async function generate(revise = false) {
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    const started = performance.now();
    setBusy(true); setError(""); setStatus(revise ? "Revising your draft…" : "Creating your experiment…"); setPreview({}); setMetrics({ first: null, complete: null });
    const targetMode = revise && experiment ? experiment.mode : mode;
    const nextPrompt = (revise ? `${experimentPrompt}\nRequested revision: ${revision}` : prompt).slice(-2500);
    try {
      const response = await fetch("/app2-lab/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: targetMode, prompt: nextPrompt, previous: revise && experiment ? JSON.stringify(experiment.result) : undefined }), signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Generation could not start."); }
      if (!response.body) throw new Error("The generation stream is unavailable.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let complete = false;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const event = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "partial") { setPreview(event); setMetrics(m => ({ ...m, first: m.first ?? performance.now() - started })); }
          if (event.type === "complete") {
            const id = crypto.randomUUID();
            const next: Experiment = targetMode === "plan" ? { id, mode: "plan", result: planSchema.parse(event.result) } : { id, mode: "activity", result: activitySchema.parse(event.result) };
            setExperiment(next); setExperimentPrompt(nextPrompt); setInteraction(initialInteraction()); setRevision(""); complete = true;
            setMetrics(m => ({ ...m, complete: performance.now() - started })); setStatus(revise ? "New version ready. Interaction state starts fresh; saved versions are unchanged." : "Ready to try. This is a local experiment, not a saved family record.");
          }
        }
      }
      if (!complete) throw new Error("The stream ended before the result was complete. Try again.");
    } catch (e) { if (controller.signal.aborted) setStatus("Stopped. Your previous draft is unchanged."); else { setError(e instanceof Error ? e.message : "Generation failed. Try again."); setStatus("Generation failed. Your previous draft is unchanged."); } setMetrics({ first: null, complete: null }); }
    finally { setBusy(false); }
  }
  function save() {
    if (!experiment) return;
    const value: Saved = { version: 1, ...experiment, prompt: experimentPrompt, interaction };
    const next = [value, ...saved.filter(s => s.id !== experiment.id)].slice(0, 8);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); setStatus("Saved on this browser. Reopen below, including your current selections. Nothing was added to Planner or Binder."); }
    catch { setError("This browser could not save the draft. Your current work is still open."); }
  }
  function reopen(value: Saved) {
    const restored = decodeSaved(value); setRenderEpoch(value => value + 1); setExperiment(restored.experiment); setInteraction(restored.interaction); setPrompt(restored.prompt); setExperimentPrompt(restored.prompt); setMode(restored.experiment.mode); setPreview({}); setMetrics({ first: null, complete: null }); setError(""); setStatus("Reopened the saved version and selections.");
  }
  const durations = experiment?.mode === "plan" ? allocateMinutes(experiment.result, interaction.minutes) : [];
  return <div className={styles.canvas}><main className={styles.lab}>
    <header><Link href="/app2">← App 2</Link><span>Development lab · example scenarios</span></header>
    <h1>A useful interface, made for the moment.</h1>
    <p className={styles.lead}>Try two approaches. Adjust a composed plan, or explore an activity with newly generated code.</p>
    <div className={styles.tabs} role="group" aria-label="Experiment type">{(["plan", "activity"] as const).map(value => <button key={value} disabled={busy} aria-pressed={mode === value} onClick={() => { setMode(value); setPrompt(examples[value]); setError(""); }}>{value === "plan" ? "01 · Composed plan" : "02 · Generated activity"}</button>)}</div>
    <label className={styles.label} htmlFor="lab-prompt">What would you like to try?</label>
    <textarea id="lab-prompt" value={prompt} maxLength={2500} disabled={busy} onChange={e => setPrompt(e.target.value)} />
    <div className={styles.actions}><button className={styles.primary} disabled={busy || prompt.trim().length < 8} onClick={() => void generate()}>Generate {mode === "plan" ? "plan" : "activity"}</button>{busy && <button onClick={() => abort.current?.abort()}>Stop</button>}<small>Use example details. These experiments do not read family records.</small></div>
    <p role="status" className={styles.status}>{status}</p>{error && <p role="alert" className={styles.error}>{error}</p>}
    {busy && <section aria-label="Generation preview" aria-busy="true" className={styles.result}><h2>{preview.title || "Building your experience"}</h2><p>{preview.introduction}</p>{preview.activities?.map((a, i) => <div key={i}><h3>{a.title}</h3><p>{a.instructions}</p></div>)}<small>{mode === "activity" ? "The activity becomes interactive when its code is complete." : "Preview appears as it is generated. Controls unlock when validation finishes."}</small></section>}
    {experiment && !busy && <section className={styles.result} aria-label="Generated result"><div className={styles.resultHeader}><div><small>{experiment.mode === "plan" ? "Composed from trusted controls" : "Generated HTML · isolated preview"}</small><h2>{experiment.result.title}</h2></div><button onClick={save}>Save local draft</button></div><p>{experiment.result.introduction}</p>
      {experiment.mode === "plan" ? <><label className={styles.slider}>Time available <strong>{interaction.minutes} minutes</strong><input aria-label="Time available" type="range" min="10" max="60" step="5" value={interaction.minutes} onChange={e => setInteraction(s => ({ ...s, minutes: Number(e.target.value) }))} /></label><ol className={styles.activities}>{experiment.result.activities.map((activity, index) => { const swapped = interaction.swapped.includes(activity.id); return <li key={activity.id}><div className={styles.activityTitle}><label><input type="checkbox" checked={interaction.done.includes(activity.id)} onChange={e => setInteraction(s => ({ ...s, done: e.target.checked ? [...s.done, activity.id] : s.done.filter(id => id !== activity.id) }))} /><span>{swapped ? activity.alternative.title : activity.title}</span></label><span>{durations[index]} min</span></div><p>{swapped ? activity.alternative.instructions : activity.instructions}</p><small>{!swapped && activity.materials.length > 0 ? `Gather: ${activity.materials.join(", ")}` : ""}</small><button onClick={() => setInteraction(s => ({ ...s, swapped: swapped ? s.swapped.filter(id => id !== activity.id) : [...s.swapped, activity.id] }))}>{swapped ? "Use original" : "Try the alternative"}</button></li>; })}</ol><p className={styles.status}>Checks are local practice markers, not learning records. The time slider adjusts allocations; instructions change only when you request a revision.</p></> : <ActivityFrame key={`${experiment.id}:${renderEpoch}`} experiment={experiment} state={interaction.activity} onState={activity => setInteraction(s => ({ ...s, activity }))} />}
      <label className={styles.label} htmlFor="lab-revision">Change this version</label><div className={styles.revision}><input id="lab-revision" maxLength={1000} placeholder="Make it simpler, or use a dinosaur theme…" value={revision} onChange={e => setRevision(e.target.value)} /><button disabled={revision.trim().length < 8} onClick={() => void generate(true)}>Revise</button></div>
    </section>}
    {(metrics.first !== null || metrics.complete !== null) && <p className={styles.metrics}>First preview: {metrics.first === null ? "waiting" : `${(metrics.first / 1000).toFixed(1)}s`} · Ready to interact: {metrics.complete === null ? "waiting" : `${(metrics.complete / 1000).toFixed(1)}s`}</p>}
    {saved.length > 0 && <section className={styles.saved}><h2>Local drafts</h2><p>Stored on this browser only. These are not synced family materials.</p>{saved.map(s => <button key={s.id} disabled={busy} onClick={() => reopen(s)}>{decodeSaved(s).experiment.result.title} <span>Reopen →</span></button>)}</section>}
  </main></div>;
}
