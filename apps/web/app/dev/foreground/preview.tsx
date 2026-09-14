"use client";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../../../components/brand/Logo";

type Turn = { id: string; prompt: string; answer: string; status: string; error: string | null; sequence: number };
export function ForegroundPreview({ session }: { session: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Ready");
  const [sending, setSending] = useState(false);
  const [connection, setConnection] = useState(0);
  const pending = useRef<{ turnId: string; prompt: string } | null>(null);
  const busy = sending || turns.some((turn) => turn.status === "accepted" || turn.status === "running");
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/dev/foreground?session=${encodeURIComponent(session)}`, { signal: controller.signal });
        if (!response.ok || !response.body) throw new Error("Could not reconnect to the saved conversation");
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!line) continue;
            const event = JSON.parse(line);
            if (event.type === "connection_error") throw new Error("Connection interrupted. Reconnect to the saved answer.");
            if (event.type === "turns") setTurns(event.turns);
          }
        }
      } catch (error) { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Connection interrupted"); }
    })();
    return () => controller.abort();
  }, [session, connection]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !session || !prompt.trim()) return;
    // Retain the same identity after an uncertain HTTP result. Reconnect never generates.
    if (!pending.current || pending.current.prompt !== prompt.trim()) pending.current = { turnId: crypto.randomUUID(), prompt: prompt.trim() };
    setSending(true); setStatus("Saving your question");
    try {
      const response = await fetch("/api/dev/foreground", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", sessionId: session, ...pending.current }) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setTurns((old) => [...old.filter((turn) => turn.id !== result.turn.id), result.turn]);
      pending.current = null; setPrompt(""); setStatus("Question saved"); setConnection((n) => n + 1);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Send could not be confirmed. Reconnect before trying again."); }
    finally { setSending(false); }
  }
  async function stop() {
    const active = turns.find((turn) => turn.status === "accepted" || turn.status === "running"); if (!active) return;
    try {
      const response = await fetch("/api/dev/foreground", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", sessionId: session, turnId: active.id }) });
      setStatus(response.ok ? "Stopped. Saved text is kept." : "Could not confirm Stop. Reconnect to check.");
    } catch { setStatus("Could not confirm Stop. Reconnect to check."); }
    setConnection((n) => n + 1);
  }
  return <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
    <Logo /><h1>Conversation recovery preview</h1>
    <p>Conversation and child-profile reads only. Other Homa actions are not enabled in this preview.</p>
    <button type="button" onClick={() => { setConnection((n) => n + 1); setStatus("Reconnecting to saved answers"); }}>Reconnect</button>
    <p role="status">{status}</p>
    {turns.map((turn) => <section key={turn.id} data-turn-id={turn.id} data-turn-status={turn.status}>
      <div className="quiet-message__user-bubble">{turn.prompt}</div>
      <div className="leading-relaxed text-body" style={{ whiteSpace: "pre-wrap" }}>{turn.answer}</div>
      <p>{turn.status === "completed" ? "Answer saved" : turn.status === "running" || turn.status === "accepted" ? "Working" : `${turn.status}. Saved text is kept.`}</p>
      {turn.error && <p>{turn.error}</p>}
      {["failed", "cancelled", "interrupted"].includes(turn.status) && <button type="button" disabled={busy} onClick={() => { pending.current = null; setPrompt(turn.prompt); setStatus("Try again starts a new answer. The previous attempt stays saved."); }}>Try again</button>}
    </section>)}
    <form onSubmit={send} className="flex flex-col gap-4">
      <textarea aria-label="Message Homa" value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)} className="rounded-md border border-border p-3" />
      {busy ? <button type="button" aria-label="Stop" onClick={() => void stop()}>Stop</button> : <button type="submit" disabled={!session || !prompt.trim()}>Send</button>}
    </form>
  </main>;
}
