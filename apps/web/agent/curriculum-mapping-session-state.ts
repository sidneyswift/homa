import { defineState } from "eve/context";

export interface CurriculumMappingSessionState {
  activeDraftId: string | null;
  lastApprovedDraftId: string | null;
}

export const curriculumMappingSessionState =
  defineState<CurriculumMappingSessionState>(
    "homa.family-curriculum-preview",
    () => ({ activeDraftId: null, lastApprovedDraftId: null }),
  );

export function canUseCurriculumMappingDraft(
  state: CurriculumMappingSessionState,
  draftId: string,
): boolean {
  return state.activeDraftId === draftId || state.lastApprovedDraftId === draftId;
}

export function activateCurriculumMappingDraft(
  state: CurriculumMappingSessionState,
  draftId: string,
): CurriculumMappingSessionState {
  return { ...state, activeDraftId: draftId };
}

export function abandonCurriculumMappingDraftState(
  state: CurriculumMappingSessionState,
  draftId: string,
): CurriculumMappingSessionState {
  return state.activeDraftId === draftId
    ? { ...state, activeDraftId: null }
    : state;
}

export function approveCurriculumMappingDraftState(
  _state: CurriculumMappingSessionState,
  draftId: string,
): CurriculumMappingSessionState {
  return { activeDraftId: null, lastApprovedDraftId: draftId };
}
