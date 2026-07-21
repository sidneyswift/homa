import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { currentWeekIndex, type PlannerData } from "../../lib/planner";
import { palette } from "../../theme/tokens";
import { spreadAcrossWeekdays, weekdayCells, type WeekdayCell } from "./week";

/**
 * Pure board assembly for the mobile week planner, ported from the
 * gathering pass in apps/web/app/app/planner/planner-view.tsx. Each
 * kid's CURRENT week of their real four-week plans is spread across the
 * five weekdays (week.ts, deterministic). Day placement is presentation
 * only; checks stay keyed by plan ("week.activityIndex"), and persisted
 * day-by-day scheduling is a later milestone (M2-10). Mobile renders
 * the whole family always: the web context switcher's one-kid focus has
 * no mobile twin yet.
 */

export interface BlockTone {
  bg: string;
  ink: string;
}

/** Block tones cycle the template's subject palette per plan position.
 * Web uses clay-700/sage-700/gold-ink/sky-600; the mobile token sheet
 * carries fewer steps, so the nearest copied ink stands in. */
const BLOCK_TONES: readonly BlockTone[] = [
  { bg: palette.clay50, ink: palette.clay700 },
  { bg: palette.sage50, ink: palette.sage600 },
  { bg: palette.gold100, ink: palette.goldInk },
  { bg: palette.sky100, ink: palette.sky500 },
];

function subjectLabel(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

/** One plan's context row in the focus strip above the day stack. */
export interface FocusRow {
  key: string;
  kidName: string;
  /** Position in the family list (tone) and the photo when added. */
  kidIndex: number;
  kidAvatarUrl: string | null;
  subjectLabel: string;
  /** Names what the focus line IS before it speaks (reader gate
   * 2026-07-11, same as web): "The goal:" for subject plans; the month
   * plan's focus is a subject summary, so it gets "This month:". */
  focusPrefix: string;
  focus: string;
  weekNumber: number;
  tone: BlockTone;
  /** Web path to the full month page, opened in the device browser. */
  monthPath: string;
  retestDue: boolean;
}

export interface BoardItem {
  key: string;
  text: string;
  /** Read straight from the plan row's server-synced check-offs: the
   * mobile board renders progress, it never writes it (see planner.ts). */
  done: boolean;
  kidName: string;
  kidIndex: number;
  kidAvatarUrl: string | null;
  tone: BlockTone;
  subjectLabel: string;
}

export interface BoardDay {
  cell: WeekdayCell;
  items: BoardItem[];
}

export interface WeekBoard {
  focusRows: FocusRow[];
  days: BoardDay[];
}

export function buildWeekBoard(
  data: Pick<PlannerData, "children" | "reportTokens" | "plans">,
  timeZone: string,
  now: Date,
): WeekBoard {
  const nowMs = now.getTime();
  const plansByKid = new Map<string, PlannerData["plans"]>();
  for (const plan of data.plans) {
    const list = plansByKid.get(plan.childId) ?? [];
    list.push(plan);
    plansByKid.set(plan.childId, list);
  }

  const days: BoardDay[] = weekdayCells(now, timeZone).map((cell) => ({
    cell,
    items: [],
  }));
  const focusRows: FocusRow[] = [];

  data.children.forEach((child, kidIndex) => {
    const token = data.reportTokens.get(child.id);
    if (!token) return;
    const kidPlans = plansByKid.get(child.id) ?? [];

    // Gather the kid's whole week first, then spread it over the five
    // days, so one kid's activities pace the week instead of piling up.
    const gathered: BoardItem[] = [];
    kidPlans.forEach((plan) => {
      const weekIdx = currentWeekIndex(plan, nowMs);
      const week = plan.weeks[weekIdx];
      // Cycle tones across the whole board (focusRows counts every plan
      // placed so far), so on the family calendar two kids' first plans
      // get different colors instead of both landing on clay.
      const tone = BLOCK_TONES[focusRows.length % BLOCK_TONES.length];
      const planKey = `${plan.childId}:${plan.subjectId}`;
      focusRows.push({
        key: planKey,
        kidName: child.name,
        kidIndex,
        kidAvatarUrl: child.avatar_url,
        subjectLabel: subjectLabel(plan.subjectId),
        focusPrefix: plan.subjectId === MONTH_PLAN_SUBJECT ? "This month:" : "The goal:",
        focus: week.focus,
        weekNumber: weekIdx + 1,
        tone,
        monthPath: `/onboarding/r/${token}/plan/${plan.subjectId}`,
        retestDue: new Date(plan.retestAt).getTime() <= nowMs,
      });
      week.activities.forEach((text, index) => {
        gathered.push({
          key: `${planKey}-${week.week}.${index}`,
          text,
          done: Boolean(plan.progress[`${week.week}.${index}`]),
          kidName: child.name,
          kidIndex,
          kidAvatarUrl: child.avatar_url,
          tone,
          subjectLabel: subjectLabel(plan.subjectId),
        });
      });
    });

    const slots = spreadAcrossWeekdays(gathered.length);
    gathered.forEach((entry, index) => {
      days[slots[index]].items.push(entry);
    });
  });

  return { focusRows, days };
}
