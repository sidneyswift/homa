import type { DashboardPlan } from "./plan-week";

/**
 * The wire shape of GET /api/map/plan/board, shared by the route and the
 * chat's planner canvas so the two can never drift. Pure types: this
 * module must stay importable from client components.
 */

export interface PlanBoardKid {
  id: string;
  name: string;
  birthMonth: string;
  avatarUrl: string | null;
  /** The child's report token: the check-off storage key + sync
   * identity, and the full-month link. Session-scoped surface, so only
   * the family's own browser ever receives it (same law as /app). */
  reportToken: string | null;
}

export interface PlanBoardPayload {
  timeZone: string;
  kids: PlanBoardKid[];
  plans: DashboardPlan[];
}

export function parsePlanBoardResponse(value: unknown): PlanBoardPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { ok?: unknown; board?: unknown };
  if (record.ok !== true || !record.board || typeof record.board !== "object") return null;
  const board = record.board as Partial<PlanBoardPayload>;
  if (typeof board.timeZone !== "string") return null;
  if (!Array.isArray(board.kids) || !Array.isArray(board.plans)) return null;
  return board as PlanBoardPayload;
}
