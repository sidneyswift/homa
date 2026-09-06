"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { setViewContextAction } from "../../app/app/view-context-actions";
import { focusChildThenOpenChat } from "./ask-homa-about-child-action";

/**
 * A door from Progress into chat: focuses the child, then opens the
 * agent (the same behavior as AskHomaAboutChild, with caller-owned
 * wording so the detail panel's doors can name their errand).
 */

const DOOR_CLASSES = {
  secondary:
    "inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60",
  link:
    "inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--clay-600)] underline underline-offset-[3px] transition-colors hover:text-[var(--clay-700)] disabled:opacity-60",
} as const;

export function ProgressChatDoor({
  childId,
  variant = "secondary",
  onOpen,
  children,
}: {
  childId: string;
  variant?: keyof typeof DOOR_CLASSES;
  onOpen?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function openFocusedChat() {
    startTransition(async () => {
      setFailed(false);
      try {
        await onOpen?.();
        await focusChildThenOpenChat(childId, {
          setViewContext: setViewContextAction,
          navigate: (href) => router.push(href),
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
      className={DOOR_CLASSES[variant]}
    >
      {children}
    </button>
    {failed ? <p role="alert" className="mt-2 text-sm text-muted">I could not open that conversation. Try again.</p> : null}
    </>
  );
}
