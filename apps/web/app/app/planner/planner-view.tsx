import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  getMapSubject,
  isInScoredRange,
  MONTH_PLAN_SUBJECT,
} from "@homa/core";

import { childTurnsAgeOn, currentWeekIndex, type DashboardPlan } from "../../../lib/plan-week";
import { weekdayCells, weekSpanLabel } from "../../../lib/time-zone";
import { KidAvatar } from "../../../components/dashboard/kid-avatar";
import {
  DayGrid,
  type PlannerDay,
  type PlannerDayItem,
  type PlannerDayPlan,
} from "./day-grid";
import { spreadAcrossWeekdays } from "./spread-week";

/**
 * The week board as a Monday-to-Friday calendar (founder ask,
 * 2026-07-10; pure render, page.tsx owns auth + data). Each kid's
 * CURRENT week of their real four-week plans is spread across the five
 * weekdays (spread-week.ts, deterministic), checkable in place through
 * the same store as the plan pages. The focus strip above the grid
 * keeps each plan's focus line, week-of-4 position, and full-plan
 * link. Day placement is presentation only, checks stay keyed by plan;
 * persisted day-by-day scheduling is a later milestone (M2-10). When
 * the context switcher has one kid selected (focusChildId), the board
 * narrows to that kid and the heading names them.
 */

interface BlockTone {
  bg: string;
  ink: string;
}

/** Block tones cycle the template's subject palette per plan position. */
const BLOCK_TONES: readonly BlockTone[] = [
  { bg: "var(--clay-50)", ink: "var(--clay-700)" },
  { bg: "var(--sage-50)", ink: "var(--sage-700)" },
  { bg: "var(--gold-100)", ink: "var(--gold-ink)" },
  { bg: "var(--sky-100)", ink: "var(--sky-600)" },
];

function subjectLabel(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

/** One plan's context row in the focus strip above the grid. */
interface FocusRow {
  key: string;
  kidName: string | null;
  /** Position in the family list (tone) and the photo when added. */
  kidIndex: number;
  kidAvatarUrl: string | null;
  subjectLabel: string;
  /** Names what the focus line IS before it speaks (reader gate
   * 2026-07-11: the bare bank statement read as a beheaded sentence).
   * "The goal:" for subject plans; the month plan's focus is a subject
   * summary, so it gets "This month:" instead. */
  focusPrefix: string;
  focus: string;
  weekNumber: number;
  tone: BlockTone;
  planHref: string | null;
  retestDue: boolean;
}

/** The slice of a child row this board actually reads. ChildRecord
 * satisfies it structurally, and so does the canvas's fetched payload,
 * so the board renders server-fed or client-fed without adapters. */
export interface PlannerKid {
  id: string;
  name: string;
  birth_month: string;
  avatar_url: string | null;
}

export function PlannerView({
  kids,
  reports,
  plans,
  timeZone,
  now,
  focusChildId,
  surface = "page",
}: {
  kids: PlannerKid[];
  reports: Map<string, { token: string | null }>;
  plans: DashboardPlan[];
  timeZone: string;
  now: Date;
  /** One kid selected in the context switcher, or null for everyone. */
  focusChildId: string | null;
  /** "canvas" when the board renders beside the chat: the ask-Homa
   * button disappears (she is already right there), the day grid stays
   * one column for the narrow panel, and month links open a new tab so
   * the conversation is never navigated away from. */
  surface?: "page" | "canvas";
}) {
  const canvas = surface === "canvas";
  const nowMs = now.getTime();
  const plansByKid = new Map<string, DashboardPlan[]>();
  for (const plan of plans) {
    const list = plansByKid.get(plan.childId) ?? [];
    list.push(plan);
    plansByKid.set(plan.childId, list);
  }

  // The switcher narrows the board; avatar tones still come from each
  // kid's position in the FULL family list so colors never shift.
  const focusKid = focusChildId ? kids.find((kid) => kid.id === focusChildId) ?? null : null;
  const visibleKids = focusKid ? [focusKid] : kids;

  const days: PlannerDay[] = weekdayCells(now, timeZone).map((cell) => ({
    cell,
    items: [],
    // D17, birthday on the board (§4.2): render-only, computed here
    // where both the cell's calendar date and the visible roster are
    // already in scope. Every visible kid whose real birthday lands on
    // this exact day, first-name only (matches the board's existing
    // first-name convention elsewhere).
    birthdays: visibleKids
      .map((kid) => {
        const age = childTurnsAgeOn(kid.birth_month, {
          year: cell.year,
          month: cell.month,
          day: cell.dayOfMonth,
        });
        return age === null ? null : `${kid.name.split(/\s+/)[0]} turns ${age}`;
      })
      .filter((label): label is string => label !== null),
  }));
  const dayPlans: PlannerDayPlan[] = [];
  const focusRows: FocusRow[] = [];
  /** Every week on the board came from age rather than from answers. */
  const showsProvisional =
    plans.length > 0 &&
    visibleKids.every((kid) =>
      (plansByKid.get(kid.id) ?? []).every((plan) => plan.provisional),
    ) &&
    visibleKids.some((kid) => (plansByKid.get(kid.id) ?? []).length > 0);

  kids.forEach((child, kidIndex) => {
    if (focusKid && child.id !== focusKid.id) return;
    const token = reports.get(child.id)?.token;
    const kidPlans = plansByKid.get(child.id) ?? [];
    // A child with no report still has an age, and an age is enough for
    // a provisional week (founder ruling onboarding-lesson-per-subject).
    // Without this the token gate below hid exactly the families this
    // was built for: the ones who have not answered anything yet.
    if (!token && !kidPlans.some((plan) => plan.provisional)) return;

    // Gather the kid's whole week first, then spread it over the five
    // days, so one kid's activities pace the week instead of piling up.
    const gathered: Omit<PlannerDayItem, "kidName" | "kidIndex" | "kidAvatarUrl">[] = [];
    kidPlans.forEach((plan) => {
      const weekIdx = currentWeekIndex(plan, nowMs);
      const week = plan.weeks[weekIdx];
      // Cycle tones across the whole board (focusRows counts every plan
      // placed so far), so on the family calendar two kids' first plans
      // get different colors instead of both landing on clay.
      const tone = BLOCK_TONES[focusRows.length % BLOCK_TONES.length];
      const planKey = `${plan.childId}:${plan.subjectId}`;
      dayPlans.push({
        key: planKey,
        childId: plan.childId,
        subjectId: plan.subjectId,
        // A provisional week has no report behind it. The key still has
        // to be unique per child so two children's local check state
        // cannot collide, even though nothing writes to it.
        token: token ?? `provisional:${plan.childId}`,
        initialChecks: plan.progress,
        ...(plan.provisional ? { readOnly: true as const } : {}),
      });
      focusRows.push({
        key: planKey,
        kidName: focusKid ? null : child.name,
        kidIndex,
        kidAvatarUrl: child.avatar_url,
        subjectLabel: subjectLabel(plan.subjectId),
        focusPrefix: plan.subjectId === MONTH_PLAN_SUBJECT ? "This month:" : "The goal:",
        focus: week.focus,
        weekNumber: weekIdx + 1,
        tone,
        // No plan page for a provisional week: there is no report to
        // hang it on, and a link to nothing is worse than no link.
        planHref: token ? `/onboarding/r/${token}/plan/${plan.subjectId}` : null,
        retestDue: !plan.provisional && new Date(plan.retestAt).getTime() <= nowMs,
      });
      week.activities.forEach((text, index) => {
        gathered.push({
          planKey,
          checkId: `${week.week}.${index}`,
          text,
          toneBg: tone.bg,
          toneInk: tone.ink,
          subjectLabel: subjectLabel(plan.subjectId),
        });
      });
    });

    const slots = spreadAcrossWeekdays(gathered.length);
    gathered.forEach((entry, index) => {
      days[slots[index]].items.push({
        ...entry,
        kidName: focusKid ? null : child.name,
        kidIndex,
        kidAvatarUrl: child.avatar_url,
      });
    });
  });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            This week {"\u00b7"} {weekSpanLabel(now, timeZone)}
          </p>
          <h1
            className={
              canvas
                ? "mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.015em] text-strong"
                : "mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong"
            }
          >
            {focusKid ? `${focusKid.name}'s week` : "Your week"}
          </h1>
          {/* A week derived from the child's age, shown before she has
              answered anything, so the planner is never an empty grid
              (founder ruling onboarding-lesson-per-subject, 2026-07-29).
              The activities are real; the claim about THIS child is not
              made, and saying so is the whole reason this line exists.
              Reassure before inform: what it is, then what changes it. */}
          {showsProvisional ? (
            <p className="mt-2 max-w-xl text-sm text-muted">
              This is a typical week for
              {focusKid ? ` a ${ageLabel(ageInMonths(focusKid.birth_month))}` : " this age"}
              , so you have something to look at. Answer
              {focusKid ? ` ${focusKid.name}'s` : " the"} questions and it
              becomes their own, and you can change any of it.
            </p>
          ) : null}
        </div>
        {canvas ? null : (
          <Link
            href="/app"
            className="rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
          >
            Ask Homa to adjust the week
          </Link>
        )}
      </header>

      {focusRows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border-subtle bg-card p-8 text-center shadow-sm">
          <p className="font-display text-xl font-semibold text-strong">
            {focusKid
              ? `There's no month set up for ${focusKid.name} yet.`
              : "There's no month set up yet."}
          </p>
          {/* Copy-kit empty-state shape, reworded through both copy gates
              (2026-07-10): define a month first, then the mechanic; the
              buttons below are the door. The checklist sentence joins
              only when a checklist button will render below, so the
              word never arrives unexplained (copy-editor gate
              2026-07-11). */}
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            A month is four weeks of small activities. One tap in the progress
            report builds it, and this page fills in.
            {visibleKids.some(
              (child) =>
                !reports.get(child.id)?.token &&
                isInScoredRange(ageInMonths(child.birth_month)),
            )
              ? " The checklist is five minutes of questions that build the first progress report."
              : ""}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {visibleKids.map((child) => {
              const token = reports.get(child.id)?.token;
              if (token) {
                return (
                  <Link
                    key={child.id}
                    href={`/onboarding/r/${token}`}
                    target={canvas ? "_blank" : undefined}
                    className="inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
                  >
                    Open {child.name}&apos;s report
                  </Link>
                );
              }
              if (isInScoredRange(ageInMonths(child.birth_month))) {
                return (
                  <Link
                    key={child.id}
                    href="/onboarding"
                    className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong transition-colors hover:border-brand"
                  >
                    Start {child.name}&apos;s checklist
                  </Link>
                );
              }
              return null;
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-1.5">
            {focusRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md px-3 py-2"
                style={{ background: row.tone.bg }}
              >
                {row.kidName ? (
                  <KidAvatar
                    name={row.kidName}
                    index={row.kidIndex}
                    avatarUrl={row.kidAvatarUrl}
                    size={22}
                    label={row.kidName}
                  />
                ) : null}
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.05em]"
                  style={{ color: row.tone.ink }}
                >
                  {row.subjectLabel}
                </span>
                <span className="min-w-0 flex-1 basis-52 text-[0.82rem] leading-snug text-body">
                  <span className="font-semibold">{row.focusPrefix}</span> {row.focus}
                </span>
                <span className="font-mono text-[0.62rem]" style={{ color: row.tone.ink }}>
                  week {row.weekNumber} of 4
                </span>
                {row.retestDue ? (
                  <span
                    className="rounded-pill px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em]"
                    style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}
                  >
                    re-check ready
                  </span>
                ) : null}
                {/* "month", never "plan": one name per concept, and this
                    page's empty state defines the month (copy-editor
                    gate 2026-07-11). */}
                {row.planHref ? (
                  <Link
                    href={row.planHref}
                    target={canvas ? "_blank" : undefined}
                    className="text-[0.72rem] font-semibold text-brand hover:underline"
                  >
                    full month
                  </Link>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3">
            <DayGrid days={days} plans={dayPlans} singleColumn={canvas} />
          </div>

          {/* Right under the boxes it forgives (reader gate 2026-07-11:
              "any day counts" was doing its work from the least-read
              spot, and "the report reads this at re-check time" was the
              one unparseable line on the page). Kept metaphor-free so
              the templates' "quiet goal" stays the surface's one image
              (copy-editor gate, same night). */}
          {/* A provisional week has no boxes to tick, so the check-off
              promise would contradict what she is looking at (caught on
              the first walk of the age template, 2026-07-29). She gets
              the door to a real one instead. */}
          <p className="mt-3 text-xs text-muted">
            {showsProvisional
              ? "Nothing to check off yet: this week is an example. Answering the questions turns it into a real month you can tick off and change."
              : "Any day counts: do the activities whenever they fit, and check them off as they happen. At the month's re-check, these check-offs go into the progress report."}
          </p>
        </>
      )}
    </>
  );
}
