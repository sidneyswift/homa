"use client";

import { useCallback, useEffect, useState } from "react";

import type { MapAnswer } from "@homa/core";

import { ChecklistStep } from "./checklist-step";
import { DeepDiveStep } from "./deep-dive-step";
import { EmailStep } from "./email-step";
import type { FlowChild, FlowPhase } from "./flow-types";
import { ExtrasStep } from "./extras-step";
import { HubStep } from "./hub-step";
import { KidsStep } from "./kids-step";
import { ScoringStep } from "./scoring-step";

/**
 * Orchestrator for the progress-report flow: email, kids, checklist per
 * kid, the optional extras step (context, once she's invested), scoring,
 * report. Every mutation is already persisted server-side by the steps;
 * this component only decides which screen shows and carries the shared
 * children list.
 */
export function MapFlow() {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [children, setChildren] = useState<FlowChild[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [familyContextDone, setFamilyContextDone] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [deepDiveDomain, setDeepDiveDomain] = useState<string | null>(null);

  const refreshState = useCallback(async (): Promise<FlowChild[] | null> => {
    try {
      const response = await fetch("/api/map/state");
      const data = (await response.json()) as {
        ok: boolean;
        email?: string;
        familyContextDone?: boolean;
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
      setFamilyContextDone(Boolean(data.familyContextDone));
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

  // On mount: does the resume cookie know this browser? A ?dd=childId.domain
  // param (report buttons, retest emails) opens straight on the deep dive.
  useEffect(() => {
    void (async () => {
      const restored = await refreshState();
      if (restored === null) {
        setPhase("email");
        return;
      }
      setWelcomeBack(true);

      const deepDive = new URLSearchParams(window.location.search).get("dd");
      if (deepDive) {
        const [childId, domainId] = deepDive.split(".");
        const target = restored.find((child) => child.id === childId && child.inRange);
        if (target && domainId) {
          setActiveChildId(target.id);
          setDeepDiveDomain(domainId);
          setPhase("deepdive");
          return;
        }
      }

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
            const restored = await refreshState();
            // Straight into the first unstarted checklist (read-through
            // ruling: no interstitial screens between adding kids and
            // the first question).
            const next = (restored ?? []).find(
              (child) => child.inRange && !child.reportToken && child.answered === 0,
            );
            if (next) {
              setActiveChildId(next.id);
              setPhase("checklist");
            } else {
              setPhase("hub");
            }
          })();
        }}
      />
    );
  }

  if (phase === "checklist" && activeChild) {
    return (
      <ChecklistStep
        child={activeChild}
        onComplete={() => setPhase("extras")}
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

  if (phase === "extras" && activeChild) {
    return (
      <ExtrasStep
        child={activeChild}
        askFamily={!familyContextDone}
        onDone={() => {
          setFamilyContextDone(true);
          setPhase("scoring");
        }}
      />
    );
  }

  if (phase === "deepdive" && activeChild && deepDiveDomain) {
    return (
      <DeepDiveStep
        child={activeChild}
        domainId={deepDiveDomain}
        onComplete={() => setPhase("scoring")}
        onExit={() => {
          void (async () => {
            await refreshState();
            setDeepDiveDomain(null);
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
