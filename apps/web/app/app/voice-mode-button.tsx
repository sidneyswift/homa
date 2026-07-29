"use client";

import { AudioLines } from "lucide-react";

/**
 * The composer's primary button while the box is empty: start talking
 * (issue #283, founder direction 2026-07-29, the ChatGPT composer shape).
 *
 * The first character she types turns this same slot into Send
 * (`composerPrimaryAction` in chat-send-policy.ts), so the two never
 * compete for one tap and an empty composer never shows a disabled Send,
 * which is a button whose only job is to look unavailable.
 *
 * It opens a voice conversation in the app. An earlier version of this
 * button dialled her phone through Telnyx; that was the wrong action in the
 * right slot. The phone line still exists for someone who wants to call a
 * number, and it is not what a tap inside the app should do.
 *
 * Deliberately does no work itself. Everything (permission, token, socket,
 * transcript) belongs to VoiceMode, which is mounted only while she is
 * actually talking, so the microphone and the socket exist for exactly that
 * long and not a moment either side.
 */
export function VoiceModeButton({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      aria-label="Talk with Homa"
      title="Talk with Homa"
      onClick={onStart}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
    >
      <AudioLines size={18} aria-hidden="true" />
    </button>
  );
}
