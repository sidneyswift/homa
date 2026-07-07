"use client";

import { useState } from "react";

/**
 * The what-are-you-doing-right capture on strength cards (read-through:
 * moms are glad to share what's working, framed as it possibly helping the
 * growing subjects too). Saves into the child's context bag via the extras
 * route; needs the resume cookie, so a shared-link viewer gets a gentle
 * hint instead of a form error.
 */
export function WhatsWorkingForm({
  childId,
  domainId,
  subjectName,
  childName,
}: {
  childId: string;
  domainId: string;
  subjectName: string;
  childName: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "no-session">("idle");

  async function save() {
    if (!text.trim()) return;
    setState("busy");
    try {
      const response = await fetch("/api/map/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child: { childId, whatsWorking: { [domainId]: text.trim() } },
        }),
      });
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      setState(response.ok ? "saved" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "saved") {
    return (
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--gold-ink)" }}>
        Saved. Whatever you&apos;re doing here works, and I&apos;ll fold it into the plans for
        the growing subjects.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-left text-xs font-semibold underline-offset-2 hover:underline print:hidden"
        style={{ color: "var(--gold-ink)" }}
      >
        What&apos;s working in {subjectName.toLowerCase()}? Tell me {"\u2192"}
      </button>
    );
  }

  return (
    <div className="mt-2 print:hidden">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        maxLength={500}
        placeholder={`Curriculum, habits, tricks: what's driving ${childName}'s ${subjectName.toLowerCase()}?`}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-strong focus:border-brand focus:outline-none"
      />
      {state === "no-session" ? (
        <p className="mt-1 text-xs" style={{ color: "var(--gold-ink)" }}>
          This box works on the device you used for the questionnaire. Or open your email link here
          first.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void save()}
          disabled={state === "busy" || !text.trim()}
          className="mt-1 rounded-pill bg-brand px-4 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          {state === "busy" ? "Saving\u2026" : "Save"}
        </button>
      )}
    </div>
  );
}
