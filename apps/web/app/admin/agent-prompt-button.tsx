"use client";

import { Bot, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { buildAgentPromptAction } from "./actions";
import type { AgentPromptSource } from "../../lib/admin/agent-prompt";

/**
 * "Prompt for agent" chip (founder ask 2026-07-13): sits beside every
 * failure row's Mark handled chip and copies a self-contained
 * diagnostic packet (built server side by lib/admin/agent-prompt.ts)
 * for pasting into an AI coding agent. The packet is never shown in
 * the UI; the clipboard is the whole interface.
 *
 * Clipboard nuance: Safari closes the user-activation window at the
 * first await, so the write must START synchronously in the click.
 * A promise-valued ClipboardItem holds the gesture open while the
 * server action builds the packet; browsers without that API fall
 * back to build-then-writeText, then to a manual copy prompt.
 */

export function AgentPromptButton({
  source,
  sourceId,
}: {
  source: AgentPromptSource;
  sourceId: string;
}) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const flashCopied = () => {
    setCopied(true);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), 2500);
  };

  const copy = async () => {
    setError(null);
    let actionError: string | null = null;
    let cachedText: string | null = null;
    const build = async (): Promise<string> => {
      if (cachedText !== null) return cachedText;
      const result = await buildAgentPromptAction(source, sourceId);
      if (result.error !== null || result.prompt === null) {
        actionError = result.error ?? "No packet came back.";
        throw new Error(actionError);
      }
      cachedText = result.prompt;
      return cachedText;
    };

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          "text/plain": build().then((text) => new Blob([text], { type: "text/plain" })),
        });
        await navigator.clipboard.write([item]);
        flashCopied();
        return;
      }
    } catch {
      if (actionError !== null) {
        setError(actionError);
        return;
      }
      // The clipboard refused the gesture-held write; try the plain path.
    }

    try {
      const text = await build();
      try {
        await navigator.clipboard.writeText(text);
        flashCopied();
      } catch {
        window.prompt("Clipboard was blocked. Copy the packet from here:", text);
      }
    } catch {
      setError(actionError ?? "Something went wrong building the packet.");
    }
  };

  const onClick = () => {
    if (pending) return;
    setPending(true);
    void copy().finally(() => setPending(false));
  };

  const Icon = copied ? Check : Bot;
  return (
    <span className="inline-flex items-center gap-2">
      {error ? (
        <span className="text-[0.7rem] font-semibold text-[var(--rose-600)]">{error}</span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title="Copies everything an AI agent needs to diagnose this failure"
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-border bg-card px-2.5 py-1 text-[0.7rem] font-bold text-muted shadow-sm transition-colors hover:text-strong disabled:opacity-50"
      >
        <Icon size={12} aria-hidden="true" />
        {copied ? "Copied" : pending ? "Building…" : "Prompt for agent"}
      </button>
    </span>
  );
}
