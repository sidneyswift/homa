"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { MapAnswer } from "@homa/core";

import { readUtmFromLocation } from "../../lib/waitlist-client";
import { ChecklistStep } from "./checklist-step";
import { DeepDiveStep } from "./deep-dive-step";
import type { FlowChild, FlowPhase } from "./flow-types";
import { ExtrasStep } from "./extras-step";
import { HubStep } from "./hub-step";
import { KidsStep } from "./kids-step";
import { ParentStep } from "./parent-step";
import { isChecklistComplete } from "./question-queue";
import { ScoringStep } from "./scoring-step";
import { SignupStep } from "./signup-step";

/**
 * Orchestrator for the progress-report flow: an anonymous session opens
 * silently, then email, kids, checklist per kid, the optional extras
 * step, password (the last question, becoming a real account), scoring,
 * report. Every mutation is already persisted server-side by the steps;
 * this component only decides which screen shows and carries the shared
 * children list.
 *
 * Founder calls 2026-07-06, in order:
 *   1. "No email needed, sign up as the last question to create an account
 *      and generate the report." Email moved from S1 to right before
 *      scoring.
 *   2. "I don't want the first question to collect the kids' name, collect
 *      the parent's name (first, last), then go into add your family."
 *      Name moved back to S1 (ahead of kids).
 *   3. Email moved back to S1 (this time to stay), with "Sign up with
 *      Google" alongside it; her name moved back to the last question,
 *      bundled with the password Google sign-ups never need to set.
 *      SignupStep is now the "turn into a real account" step, gated on
 *      hasAccount rather than email.
 *   4. Full UX review implemented ("do it all"): quiet chrome mid-flow
 *      (see OnboardingShell), fully-answered kids resume at the finish
 *      line instead of the hub, focus follows phase changes, and the
 *      checklist gained its live report rail.
 *
 * The one honesty gap this still opens: a family whose only kids are
 * outside the scored age range never reaches scoring at all, and the hub
 * already promises "I'll email you when it's ready". needsPreHubSignup()
 * closes that gap by routing to the password step before the hub whenever
 * there is no reachable checklist and no account yet.
 */

function needsPreHubSignup(children: FlowChild[], hasAccount: boolean): boolean {
  if (hasAccount || children.length === 0) return false;
  return !children.some((child) => child.inRange && !child.reportToken);
}

/** Where a family lands right after their kids list is up to date: the
 * next unstarted checklist, the finish line for a fully-answered child
 * (straight to the account gate or scoring, never a dead stop on the hub;
 * this is also the seam a Google sign-in redirect resumes through), the
 * pre-hub account gate, or the hub. Shared by every "state just changed"
 * path so the routing logic lives in exactly one place. */
type PostKidsRoute =
  | { phase: "kids" }
  | { phase: "checklist"; childId: string }
  | { phase: "signup"; childId: string | null; next: "scoring" | "hub" }
  | { phase: "scoring"; childId: string }
  | { phase: "hub" };

function decidePostKidsRoute(children: FlowChild[], hasAccount: boolean): PostKidsRoute {
  if (children.length === 0) return { phase: "kids" };
  const next = children.find((child) => child.inRange && !child.reportToken && child.answered === 0);
  if (next) return { phase: "checklist", childId: next.id };
  const finished = children.find(
    (child) => child.inRange && !child.reportToken && isChecklistComplete(child),
  );
  if (finished) {
    return hasAccount
      ? { phase: "scoring", childId: finished.id }
      : { phase: "signup", childId: finished.id, next: "scoring" };
  }
  if (needsPreHubSignup(children, hasAccount)) {
    return { phase: "signup", childId: children[0]?.id ?? null, next: "hub" };
  }
  return { phase: "hub" };
}

/** Phases whose first input autofocuses itself; every other phase change
 * moves focus to the step wrapper so keyboard and screen-reader users
 * land on the new content instead of a stale position. */
const SELF_FOCUSING_PHASES: ReadonlySet<FlowPhase> = new Set<FlowPhase>(["parent", "kids", "signup"]);

export function MapFlow({ onPhaseChange }: { onPhaseChange?: (phase: FlowPhase) => void }) {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [children, setChildren] = useState<FlowChild[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  /** True once the lead has a real Supabase Auth account (Google,
   * immediately, or password, as the last question before the report). */
  const [hasAccount, setHasAccount] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [deepDiveDomain, setDeepDiveDomain] = useState<string | null>(null);
  /** Where signup sends her next: she either just finished a checklist and
   * is heading for the report, or none of her kids are scoreable yet and
   * she's heading for the hub. */
  const [signupNext, setSignupNext] = useState<"scoring" | "hub">("hub");
  /** Set only on the parent-step to kids-step handoff, so the kids screen
   * can open with "Nice to meet you, Sarah." exactly once. */
  const [greetName, setGreetName] = useState<string | null>(null);

  const refreshState = useCallback(async (): Promise<{
    children: FlowChild[];
    email: string | null;
    firstName: string | null;
    hasAccount: boolean;
  } | null> => {
    try {
      const response = await fetch("/api/map/state");
      const data = (await response.json()) as {
        ok: boolean;
        email?: string | null;
        firstName?: string | null;
        hasAccount?: boolean;
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
      const resolvedEmail = data.email ?? null;
      const resolvedFirstName = data.firstName ?? null;
      const resolvedHasAccount = Boolean(data.hasAccount);
      setEmail(resolvedEmail);
      setHasAccount(resolvedHasAccount);
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
      return {
        children: restored,
        email: resolvedEmail,
        firstName: resolvedFirstName,
        hasAccount: resolvedHasAccount,
      };
    } catch {
      return null;
    }
  }, []);

  /** Opens the anonymous session (no email, no name) that kids/checklist
   * auto-save under. */
  const bootstrapSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/map/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "organic", utm: readUtmFromLocation() }),
      });
      const data = (await response.json()) as { ok: boolean };
      return data.ok;
    } catch {
      return false;
    }
  }, []);

  function applyPostKidsRoute(route: PostKidsRoute): void {
    if (route.phase === "checklist" || route.phase === "scoring") {
      setActiveChildId(route.childId);
      setPhase(route.phase);
      return;
    }
    if (route.phase === "signup") {
      setActiveChildId(route.childId);
      setSignupNext(route.next);
      setPhase("signup");
      return;
    }
    setPhase(route.phase);
  }

  // The shell swaps between full site chrome and quiet focus chrome off
  // the current phase.
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Focus follows the flow: when a phase without its own autofocused
  // input mounts, move focus to the fresh step content.
  useEffect(() => {
    if (phase === "loading" || SELF_FOCUSING_PHASES.has(phase)) return;
    wrapperRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // On mount: does the resume cookie know this browser? A ?dd=childId.domain
  // param (report buttons, retest emails) opens straight on the deep dive.
  useEffect(() => {
    void (async () => {
      const restored = await refreshState();
      if (restored === null) {
        const ok = await bootstrapSession();
        setPhase(ok ? "parent" : "bootstrap-error");
        return;
      }
      setWelcomeBack(true);

      // The email gate takes priority over everything else: nothing past
      // it (kids, resume links, deep dives) makes sense before we know
      // who the report is for.
      if (!restored.email) {
        setPhase("parent");
        return;
      }

      // A fresh Google sign-in landing here for the first time (no kids
      // yet) gets one personalized "Nice to meet you", using the name
      // Google's profile gave us.
      if (restored.firstName && restored.children.length === 0) {
        setGreetName(restored.firstName);
      }

      const params = new URLSearchParams(window.location.search);
      const deepDive = params.get("dd");
      if (deepDive) {
        const [childId, domainId] = deepDive.split(".");
        const target = restored.children.find((child) => child.id === childId && child.inRange);
        if (target && domainId) {
          setActiveChildId(target.id);
          setDeepDiveDomain(domainId);
          setPhase("deepdive");
          return;
        }
      }

      // ?start=childId (the report's map-the-next-kid handoff) opens that
      // kid's checklist directly.
      const startChild = params.get("start");
      if (startChild) {
        const target = restored.children.find(
          (child) => child.id === startChild && child.inRange && !child.reportToken,
        );
        if (target) {
          setActiveChildId(target.id);
          setPhase("checklist");
          return;
        }
      }

      applyPostKidsRoute(decidePostKidsRoute(restored.children, restored.hasAccount));
    })();
  }, [refreshState, bootstrapSession]);

  const activeChild = children.find((child) => child.id === activeChildId) ?? null;

  function renderPhase(): ReactNode {
    if (phase === "loading") {
      return (
        <div aria-busy="true" className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
          <div className="h-4 w-2/3 animate-pulse rounded bg-border-subtle" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-border-subtle" />
        </div>
      );
    }

    if (phase === "bootstrap-error") {
      return (
        <div className="rounded-lg border border-border-subtle bg-card p-6 text-center shadow-sm">
          <p className="font-display text-lg font-semibold text-strong">Couldn&apos;t start just now.</p>
          <p className="mt-2 text-body">Nothing was lost, one more try usually does it.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 min-h-11 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Try again
          </button>
        </div>
      );
    }

    if (phase === "parent") {
      return (
        <ParentStep
          onDone={() => {
            void (async () => {
              const restored = await refreshState();
              applyPostKidsRoute(decidePostKidsRoute(restored?.children ?? [], restored?.hasAccount ?? false));
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
          greetName={children.length === 0 ? greetName : null}
          onDone={() => {
            setGreetName(null);
            void (async () => {
              // Straight into the first unstarted checklist (read-through
              // ruling: no interstitial screens between adding kids and
              // the first question).
              const restored = await refreshState();
              applyPostKidsRoute(decidePostKidsRoute(restored?.children ?? [], restored?.hasAccount ?? false));
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
          needsSignup={!hasAccount}
          onDone={() => {
            if (hasAccount) {
              setPhase("scoring");
            } else {
              setSignupNext("scoring");
              setPhase("signup");
            }
          }}
        />
      );
    }

    if (phase === "signup") {
      return (
        <SignupStep
          child={activeChild}
          email={email}
          onDone={() => {
            void (async () => {
              await refreshState();
              setWelcomeBack(true);
              setPhase(signupNext);
            })();
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
      // A deep-dive sitting ends in that subject's rebuilt four-week plan;
      // the first full checklist ends on the report.
      return <ScoringStep child={activeChild} planDomain={deepDiveDomain} />;
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
        onChildRemoved={() => {
          void (async () => {
            const restored = await refreshState();
            // Removing the last kid lands on the add-kids form, same as a
            // fresh resume with zero kids.
            if (restored !== null && restored.children.length === 0) setPhase("kids");
          })();
        }}
      />
    );
  }

  // One keyed wrapper per phase: each step rises in gently (opacity +
  // translate, ease-out, under 300ms) instead of snapping into place.
  // The entry step spans the wide two-column hero, the checklist widens
  // for its report rail, and every other step stays a centered 36rem
  // column (the page shell is wide to allow all three).
  const widthClass =
    phase === "parent"
      ? ""
      : phase === "checklist"
        ? "mx-auto w-full max-w-[36rem] lg:max-w-[58rem]"
        : "mx-auto w-full max-w-[36rem]";
  return (
    <div
      key={phase}
      ref={wrapperRef}
      tabIndex={-1}
      className={`flow-step-in outline-none ${widthClass}`}
    >
      {renderPhase()}
    </div>
  );
}
