"use client";

import { useEffect, useState } from "react";

import type { MapAnswer } from "@homa/core";

import { ChecklistStep } from "../onboarding/checklist-step";
import type { FlowChild } from "../onboarding/flow-types";
import { checklistPositionFor } from "./onboarding-cards";

/**
 * The questions, in the chat, where everything else already is.
 *
 * This used to take over the whole screen, and the founder called it
 * (2026-07-22): "why does it go to a separate, non chat page to ask
 * these questions? Why do I have to go to the chat and back to the
 * chat? That seems like bad UI/UX." Right on every count. In a product
 * whose entire onboarding is a conversation, the one moment that leaves
 * the conversation was the questionnaire, and the leaving cost two
 * doors, a page transition each way, and a lost view of everything Homa
 * had just said.
 *
 * The full page was defended by the six dated founder corrections the
 * checklist carries: fixed card height so nothing jumps, the 140ms chip
 * flash, one reserved kicker slot, "undo last answer" rather than
 * "back", time left rather than "question 4 of 41", and the child's name
 * inside every question. That defence does not hold up. Every one of
 * those lives INSIDE the question card and travels with it. The only
 * thing the page was actually protecting is ReportRail, a side column
 * that is already absent below lg, so a parent on a phone has been
 * seeing the compact layout all along.
 *
 * So it docks now, in the composer's slot, exactly where the facts card
 * goes. The transcript stays visible above it, and there is no journey.
 *
 * It still needs almost nothing: a child, a done callback, and an exit
 * callback. It computes its own question plan, holds its own answers,
 * saves each tap with an idempotency key, and calls onComplete only
 * after every in-flight save has settled.
 *
 * Leaving is safe by construction, which is why the close control is a
 * plain quiet link rather than a warning: every tap is already saved,
 * and the receipt in the transcript says exactly where she stopped.
 */

interface MapStateChild {
  id: string;
  name: string;
  ageMonths: number;
  inRange: boolean;
  reportToken: string | null;
  answered: number;
  interests: string[];
  helpWith: string | null;
  answers: { itemId: string; answer: MapAnswer }[];
}

export interface ChecklistExit {
  childId: string;
  childName: string;
  answered: number;
  remaining: number;
  /** True when nothing is left to answer. */
  complete: boolean;
}

export function ChecklistTakeover({
  childId,
  onClose,
}: {
  childId: string;
  onClose: (exit: ChecklistExit | null) => void;
}) {
  const [child, setChild] = useState<FlowChild | null>(null);
  const [raw, setRaw] = useState<MapStateChild | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const response = await fetch("/api/map/state", { cache: "no-store" });
        if (!response.ok) throw new Error("state");
        const data = (await response.json()) as {
          ok?: boolean;
          children?: MapStateChild[];
        };
        const found = data.ok
          ? data.children?.find((entry) => entry.id === childId)
          : undefined;
        if (!current) return;
        if (!found) {
          setFailed(true);
          return;
        }
        setRaw(found);
        setChild({
          id: found.id,
          name: found.name,
          ageMonths: found.ageMonths,
          inRange: found.inRange,
          reportToken: found.reportToken,
          answered: found.answered,
          interests: found.interests ?? [],
          helpWith: found.helpWith ?? null,
          answers: Object.fromEntries(
            (found.answers ?? []).map((entry) => [entry.itemId, entry.answer]),
          ),
        });
      } catch {
        if (current) setFailed(true);
      }
    })();
    return () => {
      current = false;
    };
  }, [childId]);

  /** Re-reads the live position so the handoff carries true counts,
   *  falling back to what we loaded rather than guessing. */
  async function exitWith(): Promise<void> {
    if (!raw) {
      onClose(null);
      return;
    }
    try {
      const response = await fetch("/api/map/state", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        children?: MapStateChild[];
      };
      const found = data.ok
        ? data.children?.find((entry) => entry.id === childId)
        : undefined;
      const source = found ?? raw;
      const position = checklistPositionFor(source);
      onClose({
        childId: source.id,
        childName: source.name,
        answered: position.answered,
        remaining: position.remaining,
        complete: position.complete,
      });
    } catch {
      const position = checklistPositionFor(raw);
      onClose({
        childId: raw.id,
        childName: raw.name,
        answered: position.answered,
        remaining: position.remaining,
        complete: position.complete,
      });
    }
  }

  return (
    <div className="w-full">
      {failed ? (
        <div className="rounded-[22px] border border-border-subtle bg-card px-4 py-5 text-center shadow-md">
          <p className="text-sm text-body">
            The questions did not open. Nothing you answered is lost.
          </p>
          <button
            type="button"
            onClick={() => onClose(null)}
            className="mt-3 min-h-11 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
          >
            Try again
          </button>
        </div>
      ) : child === null ? (
        // Never a blank frame: she just pressed a button, so the first
        // paint after the tap has to visibly be something.
        <div aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-border-subtle" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-border-subtle" />
        </div>
      ) : (
        <ChecklistStep
          child={child}
          onComplete={() => void exitWith()}
          onExit={() => void exitWith()}
          // One door, and it says where it goes. The full-page version
          // had two, at opposite corners, saying different things.
          exitLabel="back to the chat"
          compact
        />
      )}
    </div>
  );
}
