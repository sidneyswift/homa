"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useWorkspaceSurface } from "../workspace/surface-context";
import { setViewContextAction } from "../../app/app/view-context-actions";
import { focusChildThenOpenChat } from "./ask-homa-about-child-action";

const ASK_HOMA_CLASSES = {
  primary:
    "inline-flex min-h-11 items-center rounded-pill bg-[var(--brand-active)] px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-[var(--clay-600)] disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60",
} as const;

export function AskHomaAboutChild({
  childId,
  childName,
  variant = "secondary",
}: {
  childId: string;
  childName: string;
  variant?: keyof typeof ASK_HOMA_CLASSES;
}) {
  const workspace = useWorkspaceSurface();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function openFocusedChat() {
    startTransition(async () => {
      setFailed(false);
      try {
        await focusChildThenOpenChat(childId, {
          setViewContext: setViewContextAction,
          navigate: (href) => workspace ? workspace.askHoma(`Help me understand ${childName}’s progress.`) : router.push(href),
        });
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <>
    <button
      type="button"
      onClick={openFocusedChat}
      disabled={isPending}
      aria-busy={isPending ? "true" : undefined}
      className={ASK_HOMA_CLASSES[variant]}
    >
      Ask Homa about {childName}
    </button>
    {failed ? <p role="alert" className="mt-2 text-sm text-muted">I could not open that conversation. Try again.</p> : null}
    </>
  );
}
