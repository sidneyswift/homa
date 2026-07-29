import { notFound } from "next/navigation";

import {
  BODY_GESTURES,
  EYE_GESTURES,
  ThinkingMark,
  type ThinkMood,
} from "../../../components/brand/ThinkingMark";
import { busyMood, genericBusyLabel } from "../../app/message-parts";

/** One flourish, pinned and looping, labelled. Bench only. */
function GestureCell({
  label,
  gesture,
  eye,
}: {
  label: string;
  gesture?: string;
  eye?: string;
}) {
  return (
    <div className="gesture-demo flex w-[104px] flex-col items-center gap-2 rounded-md border border-border-subtle p-3">
      <div className="flex h-14 items-center">
        <ThinkingMark size={44} mood="digging" hold={{ body: gesture, eye }} />
      </div>
      <span className="font-mono text-[10px] text-subtle">{label}</span>
    </div>
  );
}

/**
 * Development-only bench for the thinking mark and the wait label
 * (components/brand/ThinkingMark.tsx, genericBusyLabel in
 * app/app/message-parts.tsx).
 *
 * This renders the REAL pieces, not copies: the same component the chat
 * busy row mounts and the same function that picks its words, so a change
 * that breaks either one breaks this page. It exists because the thing it
 * shows is otherwise only visible during a live turn, for the exact number
 * of seconds that turn happens to take, which makes the long moods almost
 * impossible to look at on purpose.
 *
 * What it does NOT cover: the escalation itself. Here the moods sit side by
 * side; in the chat they arrive one at a time on a real clock, and the
 * handover between them is only visible on a real slow turn.
 *
 * Not linked from anywhere and returns 404 in production.
 */

const MOODS: { mood: ThinkMood; seconds: number; when: string }[] = [
  { mood: "settling", seconds: 0, when: "0 to 5s" },
  { mood: "working", seconds: 7, when: "5 to 15s" },
  { mood: "digging", seconds: 20, when: "15 to 45s" },
  { mood: "long", seconds: 60, when: "past 45s" },
];

export default async function ThinkingBenchPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-[var(--bg-page-warm)] [background-image:var(--bg-paper)] p-8">
      <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-6">
        <h1 className="font-mono text-xs uppercase tracking-widest text-muted">
          Thinking mark, four moods
        </h1>

        {MOODS.map(({ mood, seconds, when }) => (
          <section
            key={mood}
            className="rounded-lg border border-border bg-card p-5"
          >
            <p className="mb-4 flex items-baseline gap-3 font-mono text-xs text-muted">
              <span className="text-strong">{mood}</span>
              <span>{when}</span>
            </p>

            {/* The busy row exactly as chat-client assembles it. */}
            <div className="flex items-baseline gap-2.5 text-muted">
              <ThinkingMark size={28} mood={mood} className="self-center" />
              <span className="font-mono text-sm tabular-nums text-subtle">
                {seconds}s
              </span>
              <span className="chat-busy-label">
                {genericBusyLabel(seconds, 0)}
              </span>
            </div>

            {/* Large, for looking at the blink, the wink and the gaze. */}
            <div className="mt-5 flex items-center gap-6 border-t border-border-subtle pt-5">
              <ThinkingMark size={96} mood={mood} />
              <ThinkingMark size={44} mood={mood} />
              <div className="flex flex-col gap-1">
                {[0, 1, 2, 3, 4].map((seed) => (
                  <span key={seed} className="text-sm text-subtle">
                    {genericBusyLabel(seconds, seed)}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* The repertoire, all at once and on a loop. In the product each
            of these fires alone, seconds apart and at random, so this is
            the one place they can be compared side by side. The looping is
            bench-only: the shipped rules run each flourish exactly once. */}
        <style>{`
          .gesture-demo .tm-gesture, .gesture-demo .tm-pop,
          .gesture-demo .tm-eye, .gesture-demo .tm-pupil {
            animation-iteration-count: infinite;
          }
        `}</style>
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
            The repertoire, looping (ships as one shot, seconds apart)
          </p>
          <div className="flex flex-wrap gap-3">
            {BODY_GESTURES.map((gesture) => (
              <GestureCell key={gesture} label={gesture} gesture={gesture} />
            ))}
            {EYE_GESTURES.map((eye) => (
              <GestureCell key={`eye-${eye}`} label={`eyes: ${eye}`} eye={eye} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
            Every line, by stage and seed
          </p>
          <div className="flex flex-col gap-3">
            {[0, 7, 20, 60].map((seconds) => (
              <div key={seconds} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="w-16 shrink-0 font-mono text-xs text-subtle">
                  {busyMood(seconds)}
                </span>
                {[0, 1, 2, 3, 4].map((seed) => (
                  <span key={seed} className="text-sm text-body">
                    {genericBusyLabel(seconds, seed)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
