import type { ChildProgressView } from "../../lib/child-progress";

export interface ProgressLoadState {
  childId: string | null;
  requestId: number;
  view: ChildProgressView | null;
  loading: boolean;
  error: string | null;
}

export function createProgressLoadState(childId: string | null): ProgressLoadState {
  return {
    childId,
    requestId: 0,
    view: null,
    loading: childId !== null,
    error: null,
  };
}

/**
 * Masks state during the render before the child-change effect starts.
 * React effects run after paint, so the reducer guard alone is not enough
 * to stop one frame of another child's evidence from appearing.
 */
export function visibleProgressLoadState(
  state: ProgressLoadState,
  childId: string | null,
): ProgressLoadState {
  if (state.childId === childId) return state;
  return createProgressLoadState(childId);
}

export function startProgressLoad(
  state: ProgressLoadState,
  childId: string | null,
  requestId: number,
): ProgressLoadState {
  if (childId === null) {
    return {
      childId: null,
      requestId,
      view: null,
      loading: false,
      error: null,
    };
  }

  return {
    childId,
    requestId,
    view: state.childId === childId ? state.view : null,
    loading: true,
    error: null,
  };
}

export function completeProgressLoad(
  state: ProgressLoadState,
  childId: string,
  requestId: number,
  view: ChildProgressView | null,
): ProgressLoadState {
  if (state.childId !== childId || state.requestId !== requestId) return state;

  if (view !== null && view.childId !== childId) {
    return {
      ...state,
      loading: false,
      error: "Progress returned for a different child.",
    };
  }

  return {
    ...state,
    view,
    loading: false,
    error: null,
  };
}

export function failProgressLoad(
  state: ProgressLoadState,
  childId: string,
  requestId: number,
  error: string,
): ProgressLoadState {
  if (state.childId !== childId || state.requestId !== requestId) return state;
  return {
    ...state,
    loading: false,
    error,
  };
}
