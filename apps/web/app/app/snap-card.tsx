"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { Camera } from "lucide-react";
import { useRef } from "react";

import { Logo } from "../../components/brand/Logo";

/**
 * The snap card (approved chat redesign, frame B): when Homa asks to
 * see a page (agent/tools/ask_for_photo.ts), the ask renders as a
 * one-question card whose primary button opens the camera, so snapping
 * the page IS the answer. "Choose from my photos" covers the
 * already-took-it case (second reader gate's fix), and "Type instead"
 * stays the escape hatch. The photo stages in the composer like any
 * attachment; nothing sends until she sends.
 *
 * While this card is the conversation's live ask, the history above it
 * dims (the founder's rule: full dim ONLY behind a CTA card).
 */

export interface SnapCardData {
  question: string;
  hint: string | null;
}

export function parseSnapCardPart(part: EveMessagePart): SnapCardData | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "ask_for_photo" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.requested !== true || typeof output.question !== "string") return null;
  return {
    question: output.question,
    hint: typeof output.hint === "string" ? output.hint : null,
  };
}

export interface ActiveSnapRequest {
  message: EveMessage;
  partKey: string;
  card: SnapCardData;
}

/**
 * The one snap card that may still be answered: the newest one with no
 * user message after it. Anything older renders settled.
 */
export function latestSnapRequest(
  messages: readonly EveMessage[],
): ActiveSnapRequest | null {
  let latest: ActiveSnapRequest | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const card = parseSnapCardPart(part);
      if (card) {
        latest = { message, partKey: `${message.id}:${partIndex}`, card };
      }
    }
  }
  return latest;
}

export function SnapCard({
  card,
  active,
  onAddFiles,
  onTypeInstead,
}: {
  card: SnapCardData;
  active: boolean;
  onAddFiles?: (files: readonly File[]) => void;
  onTypeInstead?: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onAddFiles?.(files);
  }

  return (
    <section
      className="w-full max-w-[26rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      aria-label="Homa asked to see something"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
        <Logo size={15} variant="mark" />
        One question
      </p>
      <p className="mt-2.5 font-display text-lg font-semibold leading-snug text-strong">
        {card.question}
      </p>
      {card.hint ? <p className="mt-1 text-sm text-muted">{card.hint}</p> : null}
      {active ? (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onPicked}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={onPicked}
          />
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={onAddFiles === undefined}
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera size={19} aria-hidden="true" />
              Snap the page
            </button>
            <button
              type="button"
              disabled={onAddFiles === undefined}
              onClick={() => libraryRef.current?.click()}
              className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              Choose from my photos
            </button>
            <button
              type="button"
              disabled={onTypeInstead === undefined}
              onClick={onTypeInstead}
              className="min-h-9 w-full rounded-md px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              Type instead
            </button>
          </div>
          <p className="mt-2.5 text-xs text-subtle">
            The photo goes into the message box below. Nothing sends until
            you send it.
          </p>
        </>
      ) : null}
    </section>
  );
}
