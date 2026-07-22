"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { MapAnswer } from "@homa/core";

import { ChecklistStep } from "../onboarding/checklist-step";
import type { FlowChild } from "../onboarding/flow-types";
import { checklistPositionFor } from "./onboarding-cards";

/**
 * The questions, taking over the screen
 * (plans/2026-07-21-chat-first-onboarding.md §2.5).
 *
 * The existing checklist experience mounts here whole. It carries six
 * dated founder corrections (a fixed-height card that never jumps, the
 * 140ms chip flash, one reserved kicker slot, "undo last answer" rather
 * than "back", time left rather than "question 4 of 41", and the child's
 * name inside every question), and rebuilding any of that inside a chat
 * card would re-fight all six.
 *
 * It needs almost nothing: a child, a done callback, and an exit
 * callback. It computes its own question plan, holds its own answers,
 * saves each tap itself with an idempotency key, and calls onComplete
 * only after every in-flight save has settled. So the only real work
 * here is handing it the child.
 *
 * Leaving is safe by construction, which is why the close control is a
 * plain quiet link rather than a warning: every tap is already saved,
 * and the card in the transcript will say exactly where she stopped.
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

  // A portal, because position:fixed is a lie inside a transformed
  // ancestor: the element positions against that ancestor instead of the
  // viewport. The onboarding shell's entry animation was exactly such an
  // ancestor, and this overlay rendered at height zero under the one
  // button a brand new parent must be able to press. The animation is
  // fixed too (globals.css, flow-step-in), but this surface does not get
  // to depend on every future wrapper staying transform-free.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-page">
      <div className="mx-auto w-full max-w-[36rem] px-4 py-6 sm:px-6 lg:max-w-[58rem]">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void exitWith()}
            className="min-h-9 rounded-md px-2 py-1.5 text-sm text-subtle underline-offset-2 transition-colors hover:text-strong hover:underline"
          >
            Back to chat
          </button>
        </div>
        {failed ? (
          <div className="mt-10 text-center">
            <p className="text-body">
              The questions did not open. Nothing you answered is lost. You can
              try again from the chat.
            </p>
            <button
              type="button"
              onClick={() => onClose(null)}
              className="mt-4 min-h-11 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
            >
              Back to chat
            </button>
          </div>
        ) : child === null ? (
          // Never a blank frame: she just pressed a button that did
          // nothing for a day, so the first paint after the tap has to
          // visibly be something. Same pulse the card flow uses.
          <div className="mt-10" aria-hidden="true">
            <div className="h-4 w-2/3 animate-pulse rounded bg-border-subtle" />
            <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-border-subtle" />
          </div>
        ) : (
          <div className="flow-step-in mt-2">
            <ChecklistStep
              child={child}
              onComplete={() => void exitWith()}
              onExit={() => void exitWith()}
              // The same words as the link at the top, because they are
              // the same door. Two exits with two names read as two
              // different places to end up.
              exitLabel="back to chat"
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
