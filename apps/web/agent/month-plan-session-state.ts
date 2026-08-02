import { defineState } from "eve/context";

export interface MonthPlanSessionState {
  activeDraftId: string | null;
  lastApprovedDraftId: string | null;
}

export const monthPlanSessionState = defineState<MonthPlanSessionState>(
  "homa.month-plan-preview",
  () => ({ activeDraftId: null, lastApprovedDraftId: null }),
);

export function canUseMonthPlanDraft(
  state: MonthPlanSessionState,
  draftId: string,
): boolean {
  return state.activeDraftId === draftId || state.lastApprovedDraftId === draftId;
}

export function activateMonthPlanDraft(
  state: MonthPlanSessionState,
  draftId: string,
): MonthPlanSessionState {
  return { ...state, activeDraftId: draftId };
}

export function abandonMonthPlanDraftState(
  state: MonthPlanSessionState,
  draftId: string,
): MonthPlanSessionState {
  return state.activeDraftId === draftId ? { ...state, activeDraftId: null } : state;
}

export function approveMonthPlanDraftState(
  state: MonthPlanSessionState,
  draftId: string,
): MonthPlanSessionState {
  return { activeDraftId: null, lastApprovedDraftId: draftId };
}
