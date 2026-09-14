"use client";

import { useRef, useState } from "react";

import { Logo } from "../../../components/brand/Logo";

export function RuntimeBench() {
  const [arm, setArm] = useState("matched");
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [receipt, setReceipt] = useState("");
  const active = useRef<AbortController | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (active.current || !prompt.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setStatus("Working"); setAnswer(""); setReceipt(""); setQuestion(prompt);
    let completed = false;
    try {
      const response = await fetch("/api/dev/runtime-bench", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arm, prompt }), signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = pending.indexOf("\n")) !== -1) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          if (!line) continue;
          const item = JSON.parse(line);
          if (item.type === "answer") setAnswer(item.text);
          if (item.type === "completed" || item.type === "failed") setReceipt(JSON.stringify(item, null, 2));
          if (item.type === "completed") { completed = true; setStatus("Answer saved"); }
          if (item.type === "failed") throw new Error(item.message);
        }
      }
      if (!completed) throw new Error("Stream closed before the answer was saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally { active.current = null; setBusy(false); }
  }

  return <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
    <Logo />
    <h1>Response timing preview</h1>
    <p>Small question comparison. Sign in with the reserved test account first. Each Send starts a fresh conversation.</p>
    <label>Runtime <select aria-label="Runtime" value={arm} onChange={(event) => setArm(event.target.value)} disabled={busy}>
      <option value="matched">Exact full request replay</option><option value="direct">Vercel without Workflows</option><option value="agents">OpenAI hosted agent</option>
    </select></label>
    <form onSubmit={submit} className="flex flex-col gap-4">
      <textarea aria-label="Message Homa" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={busy} className="rounded-md border border-border p-3" />
      {busy ? <button type="button" aria-label="Stop" onClick={() => active.current?.abort()}>Stop</button> : <button type="submit">Send</button>}
    </form>
    <p role="status">{status}</p>
    <div className="quiet-message__user-bubble">{question}</div>
    <div className="leading-relaxed text-body" style={{ whiteSpace: "pre-wrap" }}>{answer}</div>
    <details><summary>Experiment receipt</summary><pre className="overflow-auto whitespace-pre-wrap" data-bench-receipt>{receipt}</pre></details>
  </main>;
}
