"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { MapAnswer } from "@homa/core";

import { readUtmFromLocation } from "../../lib/waitlist-client";
import { ChecklistStep } from "./checklist-step";
import { DeepDiveStep } from "./deep-dive-step";
import type { FlowChild, FlowPhase } from "./flow-types";
import { ExtrasStep } from "./extras-step";
import { FamilyStep } from "./family-step";
import { HomeschoolStep } from "./homeschool-step";
import { HubStep } from "./hub-step";
import { KidsStep } from "./kids-step";
import { NextKidStep } from "./next-kid-step";
import { ParentStep } from "./parent-step";
import { PreparingStep } from "./preparing-step";
import { isChecklistComplete } from "./question-queue";
import { ScoringStep } from "./scoring-step";

/**
 * Orchestrator for the progress-report flow: an anonymous session opens
 * silently, then S1 (name, email, password, or Google) creates the real
 * account up front, then kids, checklist per kid, the optional extras
 * step, scoring, report. Every mutation is already persisted server-side
 * by the steps; this component only decides which screen shows and
 * carries the shared children list.
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
 *   4. Full UX review implemented ("do it all"): quiet chrome mid-flow
 *      (see OnboardingShell), fully-answered kids resume at the finish
 *      line instead of the hub, focus follows phase changes, and the
 *      checklist gained its live report rail.
 *   5. Multi-kid order is the parent's call: when one kid's questions
 *      finish while another in-range kid still has open questions, the
 *      next-kid choice (NextKidStep) asks which comes first, the sibling's
 *      questions or the report. Kids answered in one sitting queue up in
 *      reportQueue and score together, so "answer everyone, then see the
 *      reports" is one path and "report per kid" stays the other.
 *   6. (2026-07-07) Starting a brand-new kid's questionnaire used to cut
 *      straight from "Start the questionnaire(s)" to the first question
 *      with no transition. beginChecklist() now interposes a short
 *      "preparing" beat (PreparingStep) whenever the target kid hasn't
 *      answered anything yet, every entry point into the checklist
 *      routes through it. Resuming an in-progress kid skips it: there's
 *      nothing new to announce.
 *
 * Founder call 2026-07-08 overturns #3's "password is the last question"
 * half: ParentStep now asks name, email, and password together, creating
 * the account immediately (same moment as a Google sign-up). hasAccount
 * is therefore always true from the moment kids exist, so the former
 * "signup" phase (SignupStep, gated on !hasAccount) is retired along with
 * needsPreHubSignup: every route past S1 assumes an account already
 * exists, and there is no honesty gap to close, S1 already promised
 * "I'll email you when it's ready" truthfully for every family.
 *
 * Founder call 2026-07-08 (second, "one onboarding for every door"): a
 * create-your-family step (FamilyStep: family name, her name, address,
 * phone, optional photo) now sits between the account moment and kids,
 * gated by familySetupDone (families.profile_completed_at) so it shows
 * exactly once. The kids step became the same add-a-child card the
 * signed-in flow uses, which collects interests and help-with up front,
 * so the extras step after the checklist only shows for a kid who left
 * both empty. After the report, the dashboard (/home) is the landing.
 */

/** The kid the next-kid choice offers: in range, no report yet, questions
 * still open, and not already finished this sitting. Kids in reportQueue
 * are excluded by id rather than by answers because the flow's copy of
 * the active kid's answers goes stale during a checklist sitting. */
function nextUnfinishedKid(children: FlowChild[], reportQueue: string[]): FlowChild | null {
  return (
    children.find(
      (child) =>
        child.inRange &&
        !child.reportToken &&
        !reportQueue.includes(child.id) &&
        !isChecklistComplete(child),
    ) ?? null
  );
}

/** Where a family lands right after their kids list is up to date: the
 * next unstarted checklist, straight to scoring for a fully-answered
 * child (never a dead stop on the hub; this is also the seam a Google
 * sign-in redirect resumes through), or the hub. Shared by every "state
 * just changed" path so the routing logic lives in exactly one place. */
type PostKidsRoute =
  | { phase: "kids" }
  | { phase: "checklist"; childId: string }
  | { phase: "scoring"; childId: string }
  | { phase: "hub" };

function decidePostKidsRoute(children: FlowChild[]): PostKidsRoute {
  if (children.length === 0) return { phase: "kids" };
  const next = children.find((child) => child.inRange && !child.reportToken && child.answered === 0);
  if (next) return { phase: "checklist", childId: next.id };
  const finished = children.find(
    (child) => child.inRange && !child.reportToken && isChecklistComplete(child),
  );
  if (finished) return { phase: "scoring", childId: finished.id };
  return { phase: "hub" };
}

/** Phases whose first input autofocuses itself; every other phase change
 * moves focus to the step wrapper so keyboard and screen-reader users
 * land on the new content instead of a stale position. */
const SELF_FOCUSING_PHASES: ReadonlySet<FlowPhase> = new Set<FlowPhase>(["parent", "family", "kids"]);

export function MapFlow({ onPhaseChange }: { onPhaseChange?: (phase: FlowPhase) => void }) {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [children, setChildren] = useState<FlowChild[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [deepDiveDomain, setDeepDiveDomain] = useState<string | null>(null);
  /** Ids of kids whose questions finished this sitting, reports pending,
   * in the order they finished. Scoring builds all of them in one beat and
   * lands on the first one's report. */
  const [reportQueue, setReportQueue] = useState<string[]>([]);
  /** For FamilyStep's greeting and prefills (her name from signup or the
   * Google profile). */
  const [parentNames, setParentNames] = useState<{ first: string | null; last: string | null }>({
    first: null,
    last: null,
  });
  /** The kid PreparingStep is announcing, and where to land once it's
   * done; null whenever "preparing" isn't the current phase. */
  const [preparingChild, setPreparingChild] = useState<{ name: string; ageMonths: number } | null>(null);
  const [pendingChecklistId, setPendingChecklistId] = useState<string | null>(null);

  const refreshState = useCallback(async (): Promise<{
    children: FlowChild[];
    email: string | null;
    firstName: string | null;
    familySetupDone: boolean;
    familyContextDone: boolean;
  } | null> => {
    try {
      const response = await fetch("/api/map/state");
      const data = (await response.json()) as {
        ok: boolean;
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        familyContextDone?: boolean;
        familySetupDone?: boolean;
        children?: Array<{
          id: string;
          name: string;
          ageMonths: number;
          inRange: boolean;
          reportToken: string | null;
          interests?: string[];
          helpWith?: string | null;
          answers: Array<{ itemId: string; answer: MapAnswer }>;
        }>;
      };
      if (!data.ok) return null;
      const resolvedEmail = data.email ?? null;
      const resolvedFirstName = data.firstName ?? null;
      setEmail(resolvedEmail);
      setParentNames({ first: resolvedFirstName, last: data.lastName ?? null });
      const restored = (data.children ?? []).map((child) => ({
        id: child.id,
        name: child.name,
        ageMonths: child.ageMonths,
        inRange: child.inRange,
        reportToken: child.reportToken,
        interests: child.interests ?? [],
        helpWith: child.helpWith ?? null,
        answers: Object.fromEntries(child.answers.map((entry) => [entry.itemId, entry.answer])),
        answered: child.answers.length,
      }));
      setChildren(restored);
      return {
        children: restored,
        email: resolvedEmail,
        firstName: resolvedFirstName,
        familySetupDone: Boolean(data.familySetupDone),
        familyContextDone: Boolean(data.familyContextDone),
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

  /** The one door into the checklist: a kid with zero answers so far gets
   * the PreparingStep beat first, a kid already partway through resumes
   * straight in. Every call site that can land on "checklist" routes
   * through here instead of setting activeChildId/phase directly. */
  function beginChecklist(child: FlowChild): void {
    if (child.answered === 0) {
      setPreparingChild({ name: child.name, ageMonths: child.ageMonths });
      setPendingChecklistId(child.id);
      setPhase("preparing");
      return;
    }
    setActiveChildId(child.id);
    setPhase("checklist");
  }

  function applyPostKidsRoute(route: PostKidsRoute, childrenList: FlowChild[]): void {
    if (route.phase === "checklist") {
      const child = childrenList.find((candidate) => candidate.id === route.childId);
      if (child) {
        beginChecklist(child);
      } else {
        setActiveChildId(route.childId);
        setPhase("checklist");
      }
      return;
    }
    if (route.phase === "scoring") {
      setActiveChildId(route.childId);
      setPhase(route.phase);
      return;
    }
    setPhase(route.phase);
  }

  /** The last stretch before the report(s): the account already exists
   * (S1 created it), so this always goes straight to scoring. */
  function advanceToReports(): void {
    setPhase("scoring");
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
      let restored = await refreshState();
      if (restored === null) {
        const ok = await bootstrapSession();
        if (!ok) {
          setPhase("bootstrap-error");
          return;
        }
        // A signed-in user with no family yet (an account from the old
        // /signin create-account tab, say): the state call links their
        // auth session to the fresh anonymous family server-side, so one
        // re-read routes them past the signup screen instead of asking
        // them to sign up a second time.
        restored = await refreshState();
        if (restored === null || !restored.email) {
          setPhase("parent");
          return;
        }
      } else {
        setWelcomeBack(true);
      }

      // The email gate takes priority over everything else: nothing past
      // it (kids, resume links, deep dives) makes sense before we know
      // who the report is for.
      if (!restored.email) {
        setPhase("parent");
        return;
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
      // kid's checklist directly. A kid with no questions left falls
      // through to the router below, which sends finished kids to
      // scoring; the checklist has no way to complete an already-complete
      // kid.
      const startChild = params.get("start");
      if (startChild) {
        const target = restored.children.find(
          (child) =>
            child.id === startChild &&
            child.inRange &&
            !child.reportToken &&
            !isChecklistComplete(child),
        );
        if (target) {
          beginChecklist(target);
          return;
        }
      }

      // The create-your-family gate (deep links above bypass it: those
      // serve already-engaged families mid-task, and the card catches
      // them on their next plain visit instead).
      if (!restored.familySetupDone) {
        setPhase("family");
        return;
      }

      applyPostKidsRoute(decidePostKidsRoute(restored.children), restored.children);
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
              // The create-your-family card is always next for a fresh
              // signup; a returning account that already finished it
              // (folded into an older family) routes past.
              const restored = await refreshState();
              if (restored === null || !restored.familySetupDone) {
                setPhase("family");
                return;
              }
              applyPostKidsRoute(decidePostKidsRoute(restored.children), restored.children);
            })();
          }}
        />
      );
    }

    if (phase === "family") {
      return (
        <FamilyStep
          firstName={parentNames.first}
          lastName={parentNames.last}
          onDone={() => {
            void (async () => {
              // The about-your-homeschool questions come next for a
              // brand-new family (founder call 2026-07-08: during
              // onboarding, after the family card, before kids). A
              // returning family that already has kids or already gave
              // this context resumes wherever its kids actually are;
              // this step is a one-shot beat in the linear sequence,
              // never a resume gate, so skipping it never nags.
              const restored = await refreshState();
              const childrenList = restored?.children ?? [];
              if (childrenList.length === 0 && !restored?.familyContextDone) {
                setPhase("homeschool");
                return;
              }
              applyPostKidsRoute(decidePostKidsRoute(childrenList), childrenList);
            })();
          }}
        />
      );
    }

    if (phase === "homeschool") {
      return (
        <HomeschoolStep
          onDone={() => {
            void (async () => {
              const restored = await refreshState();
              const childrenList = restored?.children ?? [];
              applyPostKidsRoute(decidePostKidsRoute(childrenList), childrenList);
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
              // Into the first unstarted checklist, by way of the
              // PreparingStep beat beginChecklist interposes for a kid
              // who hasn't answered anything yet (2026-07-07 follow-up).
              const restored = await refreshState();
              const childrenList = restored?.children ?? [];
              applyPostKidsRoute(decidePostKidsRoute(childrenList), childrenList);
            })();
          }}
        />
      );
    }

    if (phase === "preparing" && preparingChild) {
      return (
        <PreparingStep
          child={preparingChild}
          onDone={() => {
            setPreparingChild(null);
            if (pendingChecklistId) setActiveChildId(pendingChecklistId);
            setPendingChecklistId(null);
            setPhase("checklist");
          }}
        />
      );
    }

    if (phase === "checklist" && activeChild) {
      const finishedId = activeChild.id;
      return (
        <ChecklistStep
          child={activeChild}
          onComplete={() => {
            const queueAfter = reportQueue.includes(finishedId)
              ? reportQueue
              : [...reportQueue, finishedId];
            setReportQueue(queueAfter);
            // The extras step never asks twice: a kid whose interests or
            // help-with are already on file (an earlier sitting, the chat
            // agent's profile tool) skips straight past it.
            const extrasAlreadyAnswered =
              activeChild.interests.length > 0 || activeChild.helpWith !== null;
            if (!extrasAlreadyAnswered) {
              setPhase("extras");
              return;
            }
            const pendingKid = nextUnfinishedKid(children, queueAfter);
            if (pendingKid) {
              setPhase("next-kid");
              return;
            }
            advanceToReports();
          }}
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
      const pendingKid = nextUnfinishedKid(children, reportQueue);
      return (
        <ExtrasStep
          child={activeChild}
          hasNextKid={pendingKid !== null}
          pendingReportCount={Math.max(1, reportQueue.length)}
          onDone={() => {
            if (pendingKid) {
              setPhase("next-kid");
              return;
            }
            advanceToReports();
          }}
        />
      );
    }

    // With nobody left to offer (unreachable in practice), this falls
    // through to the hub like every other phase-state mismatch; the hub's
    // finished-kid card keeps the report one tap away.
    if (phase === "next-kid") {
      const pendingKid = nextUnfinishedKid(children, reportQueue);
      if (pendingKid) {
        const pendingNames = reportQueue
          .map((id) => children.find((child) => child.id === id)?.name)
          .filter((name): name is string => Boolean(name));
        return (
          <NextKidStep
            nextKid={pendingKid}
            pendingNames={pendingNames}
            onAnswerNext={() => beginChecklist(pendingKid)}
            onSeeReports={advanceToReports}
          />
        );
      }
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
      // A deep-dive sitting rescores one kid and ends in that subject's
      // rebuilt four-week plan. A checklist sitting scores every kid whose
      // questions are done and unscored (this sitting's queue first, in
      // the order they finished, then any kid finished on an earlier
      // visit) and ends on the first one's report.
      const queued = reportQueue
        .map((id) => children.find((child) => child.id === id))
        .filter((child): child is FlowChild => Boolean(child));
      const alsoFinished = children.filter(
        (child) =>
          child.inRange &&
          !child.reportToken &&
          !reportQueue.includes(child.id) &&
          isChecklistComplete(child),
      );
      const kids = deepDiveDomain ? [activeChild] : [...queued, ...alsoFinished];
      return <ScoringStep kids={kids.length > 0 ? kids : [activeChild]} planDomain={deepDiveDomain} />;
    }

    return (
      <HubStep
        childrenList={children}
        email={email}
        welcomeBack={welcomeBack}
        onStartChecklist={(childId) => {
          const child = children.find((candidate) => candidate.id === childId);
          if (child) beginChecklist(child);
        }}
        onSeeReport={(childId) => {
          setActiveChildId(childId);
          // Head of the queue = the report she lands on. Any other kid
          // finished earlier still scores in the same beat.
          setReportQueue((queue) => (queue.includes(childId) ? queue : [childId, ...queue]));
          advanceToReports();
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
