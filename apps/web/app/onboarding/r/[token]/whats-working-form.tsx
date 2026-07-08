"use client";

import { useState } from "react";

/**
 * The how-did-you-get-here question, re-homed into the subject DRAWER
 * (read-through 2026-07-08: the strength card is the wrong surface, and
 * "it's not even a question"). Now it asks one, next to "where to take
 * it next". Saves into the child's context bag via the extras route.
 * Every failure state is VISIBLE (the live bug was a silently dead
 * button): saved, failed, and no-session each render a clear line.
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
  const [state, setState] = useState<"idle" | "busy" | "saved" | "failed" | "no-session">("idle");

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
      setState(response.ok ? "saved" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "saved") {
    return (
      <p className="mt-3 rounded-md bg-[var(--accent-sage-soft)] px-3 py-2 text-xs leading-relaxed text-sage-700" style={{ color: "var(--sage-700)" }}>
        Saved. I&apos;ll borrow what works here for the growing subjects&apos; months.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-left text-xs font-semibold text-brand underline-offset-2 hover:underline print:hidden"
      >
        How did {childName} get {subjectName.toLowerCase()} this strong? Tell me and I&apos;ll
        borrow it for the growing subjects {"\u2192"}
      </button>
    );
  }

  return (
    <div className="mt-3 print:hidden">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        maxLength={500}
        placeholder={`Curriculum, habits, tricks: what's driving ${childName}'s ${subjectName.toLowerCase()}?`}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-strong focus:border-brand focus:outline-none"
      />
      {state === "no-session" ? (
        <p className="mt-1 rounded-md px-3 py-2 text-xs font-semibold" style={{ background: "var(--info-soft)", color: "var(--sky-600)" }}>
          I can&apos;t save from this browser: it isn&apos;t signed in to this report&apos;s
          family. Open your email link here once (or use the device you answered on) and this
          box works.
        </p>
      ) : (
        <>
          {state === "failed" ? (
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--clay-600)" }}>
              That didn&apos;t save. One more tap usually does it.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={state === "busy" || !text.trim()}
            className="mt-1 rounded-pill bg-brand px-4 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            {state === "busy" ? "Saving\u2026" : "Save"}
          </button>
        </>
      )}
    </div>
  );
}
