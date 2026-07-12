export interface ProgressActionLifecycleState {
  pendingActionKeys: ReadonlySet<string>;
  consumedActionKeys: ReadonlySet<string>;
}

export function createProgressActionLifecycleState(): ProgressActionLifecycleState {
  return {
    pendingActionKeys: new Set(),
    consumedActionKeys: new Set(),
  };
}

export function progressActionUnavailableKeys(
  state: ProgressActionLifecycleState,
): ReadonlySet<string> {
  return new Set([
    ...state.pendingActionKeys,
    ...state.consumedActionKeys,
  ]);
}

export function beginProgressAction(
  state: ProgressActionLifecycleState,
  actionKey: string,
): {
  accepted: boolean;
  state: ProgressActionLifecycleState;
} {
  if (
    state.pendingActionKeys.has(actionKey) ||
    state.consumedActionKeys.has(actionKey)
  ) {
    return { accepted: false, state };
  }
  const pendingActionKeys = new Set(state.pendingActionKeys);
  pendingActionKeys.add(actionKey);
  return {
    accepted: true,
    state: {
      pendingActionKeys,
      consumedActionKeys: state.consumedActionKeys,
    },
  };
}

export function settleProgressAction(
  state: ProgressActionLifecycleState,
  actionKey: string,
  result: "rejected" | "queued" | "sent",
): ProgressActionLifecycleState {
  const pendingActionKeys = new Set(state.pendingActionKeys);
  pendingActionKeys.delete(actionKey);
  if (result === "rejected") {
    return {
      pendingActionKeys,
      consumedActionKeys: state.consumedActionKeys,
    };
  }
  const consumedActionKeys = new Set(state.consumedActionKeys);
  consumedActionKeys.add(actionKey);
  return { pendingActionKeys, consumedActionKeys };
}

export function releaseProgressAction(
  state: ProgressActionLifecycleState,
  actionKey: string,
): ProgressActionLifecycleState {
  const pendingActionKeys = new Set(state.pendingActionKeys);
  const consumedActionKeys = new Set(state.consumedActionKeys);
  pendingActionKeys.delete(actionKey);
  consumedActionKeys.delete(actionKey);
  return { pendingActionKeys, consumedActionKeys };
}
