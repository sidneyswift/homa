"use client";

import { useCallback, useEffect, useState } from "react";

import type { MapAnswer } from "@homa/core";

import { ChecklistStep } from "./checklist-step";
import { EmailStep } from "./email-step";
import type { FlowChild, FlowPhase } from "./flow-types";
import { HubStep } from "./hub-step";
import { KidsStep } from "./kids-step";
import { ScoringStep } from "./scoring-step";

/**
 * Orchestrator for the map flow's state machine (states S1 to S5 in the
 * plan). Every mutation is already persisted server-side by the steps;
 * this component only decides which screen shows and carries the shared
 * children list.
 */
export function MapFlow() {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [children, setChildren] = useState<FlowChild[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const refreshState = useCallback(async (): Promise<FlowChild[] | null> => {
    try {
      const response = await fetch("/api/map/state");
      const data = (await response.json()) as {
        ok: boolean;
        email?: string;
        children?: Array<{
          id: string;
          name: string;
          ageMonths: number;
          inRange: boolean;
          reportToken: string | null;
          answers: Array<{ itemId: string; answer: MapAnswer }>;
        }>;
      };
      if (!data.ok) return null;
      setEmail(data.email ?? null);
      const restored = (data.children ?? []).map((child) => ({
        id: child.id,
        name: child.name,
        ageMonths: child.ageMonths,
        inRange: child.inRange,
        reportToken: child.reportToken,
        answers: Object.fromEntries(child.answers.map((entry) => [entry.itemId, entry.answer])),
        answered: child.answers.length,
      }));
      setChildren(restored);
      return restored;
    } catch {
      return null;
    }
  }, []);

  // On mount: does the resume cookie know this browser?
  useEffect(() => {
    void (async () => {
      const restored = await refreshState();
      if (restored === null) {
        setPhase("email");
        return;
      }
      setWelcomeBack(true);
      setPhase(restored.length === 0 ? "kids" : "hub");
    })();
  }, [refreshState]);

  const activeChild = children.find((child) => child.id === activeChildId) ?? null;

  if (phase === "loading") {
    return (
      <div aria-busy="true" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="h-4 w-2/3 animate-pulse rounded bg-border-subtle" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-border-subtle" />
      </div>
    );
  }

  if (phase === "email") {
    return (
      <EmailStep
        onDone={(returning) => {
          setWelcomeBack(returning);
          void (async () => {
            if (returning) {
              const restored = await refreshState();
              setPhase(restored && restored.length > 0 ? "hub" : "kids");
            } else {
              setPhase("kids");
            }
          })();
        }}
      />
    );
  }

  if (phase === "kids") {
    return (
      <KidsStep
        existingCount={children.length}
        welcomeBack={welcomeBack && children.length === 0}
        onDone={() => {
          void (async () => {
            await refreshState();
            setPhase("hub");
          })();
        }}
      />
    );
  }

  if (phase === "checklist" && activeChild) {
    return (
      <ChecklistStep
        child={activeChild}
        onComplete={() => setPhase("scoring")}
        onExit={() => {
          void (async () => {
            await refreshState();
            setActiveChildId(null);
            setPhase("hub");
          })();
        }}
      />
    );
  }

  if (phase === "scoring" && activeChild) {
    return <ScoringStep child={activeChild} />;
  }

  return (
    <HubStep
      childrenList={children}
      email={email}
      welcomeBack={welcomeBack}
      onStartChecklist={(childId) => {
        setActiveChildId(childId);
        setPhase("checklist");
      }}
      onAddKids={() => setPhase("kids")}
    />
  );
}
