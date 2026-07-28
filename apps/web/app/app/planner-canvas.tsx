"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { CalendarDays, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SidePanel } from "../../components/chassis/side-panel";
import { parsePlanBoardResponse, type PlanBoardPayload } from "../../lib/plan-board";
import { planChecksStorageKey, overwritePlanChecks } from "../../lib/use-plan-checks";
import { PlannerView } from "./planner/planner-view";

/**
 * The planner canvas (founder ask 2026-07-19, the Vercel-chatbot
 * artifact shape translated to eve): when Homa calls open_planner, the
 * week board opens BESIDE the chat instead of navigating away, and a
 * small card stays in the transcript to reopen it later. The canvas is
 * chat-turn state, not a route: the tool's output part is the open
 * signal (the same tool-output-to-card seam as snap-card.tsx), a fetch
 * of /api/map/plan/board supplies the data, and each plan-writing tool
 * result (PLAN_WRITE_TOOLS below: edit_plan, schedule_plan_activity)
 * refreshes it, so the parent watches Homa fill the week in place.
 *
 * Two geometries, chosen by variant (plans/2026-07-21-chat-first-onboarding.md
 * §2.7): "app" is the existing full-screen mobile takeover / docked
 * desktop column, the later app shell, unchanged. "onboarding" comes
 * down to the shared SidePanel chassis instead, a sheet beside the
 * chat rather than over it, because a first-days parent should never
 * lose the conversation she is mid-sitting in.
 */

export interface PlannerOpenSignal {
  /** Narrowed child, or null for the whole family's board. */
  childId: string | null;
}

export function parsePlannerOpenPart(part: EveMessagePart): PlannerOpenSignal | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "open_planner" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.opened !== true) return null;
  return {
    childId: typeof output.childId === "string" ? output.childId : null,
  };
}

export interface LatestPlannerOpen {
  partKey: string;
  signal: PlannerOpenSignal;
}

/** The newest open_planner output in the live session, if any. Unlike
 * the snap card there is no "settled by the next user message" rule:
 * the canvas belongs to the whole sitting, and the chat client decides
 * (by part key) whether a signal is new enough to auto-open. */
export function latestPlannerOpen(
  messages: readonly EveMessage[],
): LatestPlannerOpen | null {
  let latest: LatestPlannerOpen | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const signal = parsePlannerOpenPart(part);
      if (signal) {
        latest = { partKey: `${message.id}:${partIndex}`, signal };
      }
    }
  }
  return latest;
}

/** Every tool whose success writes the plan board or its schedule, and
 * the output flag that marks a real write (issue #257, arc PR B0: the
 * canvas used to refresh only on edit_plan, so Homa could schedule math
 * to Tuesday while the panel beside the parent never moved). */
const PLAN_WRITE_TOOLS: Record<string, string> = {
  edit_plan: "updated",
  schedule_plan_activity: "scheduled",
};

/** How many plan writes the live session has streamed so far: the
 * canvas refetches whenever this number grows. Counting parts (not
 * diffing content) keeps the signal cheap and monotonic. */
export function planEditCount(messages: readonly EveMessage[]): number {
  let count = 0;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
      const successFlag = PLAN_WRITE_TOOLS[part.toolName];
      if (
        successFlag !== undefined &&
        ((part.output ?? {}) as Record<string, unknown>)[successFlag] === true
      ) {
        count += 1;
      }
    }
  }
  return count;
}

/** The transcript's planner card: quiet on scrollback, one button. */
export function PlannerCard({
  childName,
  onOpen,
}: {
  childName: string | null;
  onOpen?: () => void;
}) {
  return (
    <section
      className="flex w-full max-w-[26rem] items-center gap-3 rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
      aria-label="The week planner"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ background: "var(--sage-50)", color: "var(--sage-700)" }}
      >
        <CalendarDays size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-strong">
          {childName ? `${childName}'s week` : "Your week"}
        </p>
        <p className="text-xs text-muted">The planner, right beside the chat.</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={onOpen === undefined}
        className="min-h-9 shrink-0 rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-strong transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        Open
      </button>
    </section>
  );
}

type BoardState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; board: PlanBoardPayload };

/**
 * The panel itself. Fetches the board on open and again whenever
 * refreshSignal grows (one edit_plan result = one refetch). After an
 * edit-triggered refetch the server's check-off map is written THROUGH
 * to localStorage: the server just remapped indices, so right now it is
 * the truth, and a stale local copy would tick the wrong boxes.
 */
export function PlannerCanvasPanel({
  childId,
  refreshSignal,
  onClose,
  variant = "app",
}: {
  childId: string | null;
  refreshSignal: number;
  onClose: () => void;
  /** "app" (default): every existing call site, unchanged. "onboarding":
   * the shared SidePanel chassis, so chat stays visibly peeking above. */
  variant?: "app" | "onboarding";
}) {
  const [state, setState] = useState<BoardState>({ phase: "loading" });
  const lastRefreshRef = useRef(refreshSignal);

  // A promise chain, not an async body: every setState lives inside a
  // .then/.catch callback, so the effect's synchronous path never sets
  // state (the set-state-in-effect rule's cascade concern).
  const fetchBoard = useCallback((overwriteChecks: boolean) => {
    fetch("/api/map/plan/board")
      .then((response) => response.json())
      .then((payload) => {
        const board = parsePlanBoardResponse(payload);
        if (!board) {
          setState({ phase: "error" });
          return;
        }
        if (overwriteChecks) {
          for (const plan of board.plans) {
            const token = board.kids.find((kid) => kid.id === plan.childId)?.reportToken;
            if (!token) continue;
            overwritePlanChecks(
              planChecksStorageKey(token, plan.subjectId),
              plan.progress,
            );
          }
        }
        setState({ phase: "ready", board });
      })
      .catch(() => {
        setState({ phase: "error" });
      });
  }, []);

  useEffect(() => {
    fetchBoard(false);
  }, [fetchBoard]);

  useEffect(() => {
    if (refreshSignal === lastRefreshRef.current) return;
    lastRefreshRef.current = refreshSignal;
    fetchBoard(true);
  }, [refreshSignal, fetchBoard]);

  const headingId = "planner-canvas-heading";
  const header = (
    <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
      <p id={headingId} className="text-sm font-semibold text-strong">
        Week planner
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/app/planner"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Full page
        </Link>
        <button
          type="button"
          aria-label="Close the planner"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-card hover:text-strong"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
  const body = (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
      {state.phase === "loading" ? (
        <PlannerBoardSkeleton />
      ) : state.phase === "error" ? (
        <p className="text-sm text-muted">
          The planner didn&apos;t load. It&apos;s still there:{" "}
          <Link href="/app/planner" className="font-semibold text-brand hover:underline">
            open the full page
          </Link>
          .
        </p>
      ) : (
        <PlannerView
          kids={state.board.kids.map((kid) => ({
            id: kid.id,
            name: kid.name,
            birth_month: kid.birthMonth,
            avatar_url: kid.avatarUrl,
          }))}
          reports={
            new Map(
              state.board.kids.map((kid) => [kid.id, { token: kid.reportToken }]),
            )
          }
          plans={state.board.plans}
          timeZone={state.board.timeZone}
          now={new Date()}
          focusChildId={childId}
          surface="canvas"
        />
      )}
    </div>
  );

  if (variant === "onboarding") {
    return (
      <SidePanel labelledBy={headingId} onClose={onClose}>
        {header}
        {body}
      </SidePanel>
    );
  }

  return (
    <aside
      aria-label="Week planner"
      className="fixed inset-0 z-40 flex flex-col bg-page lg:static lg:z-auto lg:w-[min(560px,44vw)] lg:shrink-0 lg:border-l lg:border-border-subtle"
    >
      {header}
      {body}
    </aside>
  );
}

/** A board-shaped skeleton at final dimensions (the Monday-Friday day
 * grid PlannerView renders), so the fill is a 200ms crossfade rather
 * than a layout jump. Replaces the prior bare-text "Setting up the
 * week…" line, which the spec calls out as below the bar
 * (plans/2026-07-21-chat-first-onboarding.md §2.7). */
function PlannerBoardSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      {Array.from({ length: 5 }, (_, dayIndex) => (
        <div
          key={dayIndex}
          className="rounded-md border border-border-subtle bg-card p-2.5"
        >
          <div className="h-3 w-2/3 animate-pulse rounded bg-border-subtle" />
          <div className="mt-3 h-16 animate-pulse rounded bg-border-subtle" />
          <div className="mt-2 h-16 animate-pulse rounded bg-border-subtle" />
        </div>
      ))}
    </div>
  );
}
