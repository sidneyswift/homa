export interface TurnBoundaryWatchdog {
  begin(nowMs: number): void;
  noteActivity(nowMs: number): void;
  check(nowMs: number): void;
  finish(): void;
}

export function createTurnBoundaryWatchdog<T>(_input: {
  stallMs: number;
  probe: (signal: AbortSignal) => Promise<T | null>;
  onRecovered: (value: T) => void;
}): TurnBoundaryWatchdog {
  const input = _input;
  let active = false;
  let lastActivityAtMs = 0;
  let lastProbeStartedAtMs = Number.NEGATIVE_INFINITY;
  let activeProbe: AbortController | null = null;

  function cancelProbe(): void {
    const probe = activeProbe;
    activeProbe = null;
    probe?.abort();
  }

  return {
    begin(nowMs) {
      cancelProbe();
      active = true;
      lastActivityAtMs = nowMs;
      lastProbeStartedAtMs = Number.NEGATIVE_INFINITY;
    },
    noteActivity(nowMs) {
      if (!active) return;
      lastActivityAtMs = nowMs;
      cancelProbe();
    },
    check(nowMs) {
      if (!active || activeProbe) return;
      const quietSinceMs = Math.max(
        lastActivityAtMs,
        lastProbeStartedAtMs,
      );
      if (nowMs - quietSinceMs < input.stallMs) return;

      const controller = new AbortController();
      activeProbe = controller;
      lastProbeStartedAtMs = nowMs;
      void input.probe(controller.signal).then(
        (recovered) => {
          if (
            activeProbe !== controller
            || controller.signal.aborted
            || !active
          ) {
            return;
          }
          activeProbe = null;
          if (recovered === null) return;
          active = false;
          input.onRecovered(recovered);
        },
        () => {
          if (activeProbe === controller) activeProbe = null;
        },
      );
    },
    finish() {
      active = false;
      cancelProbe();
    },
  };
}
