export function percentile(values, fraction) {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}
export function summarize(runs) {
  const gaps = runs.flatMap((run) => run.responseGapsMs ?? []);
  return { samples: runs.length, passed: runs.filter((run) => run.grade?.pass === true && !run.harnessError && !run.scenarioFailure).length,
    failed: runs.filter((run) => (run.grade?.pass === false || run.scenarioFailure) && !run.harnessError).length,
    harnessFailures: runs.filter((run) => run.harnessError).length,
    ungraded: runs.filter((run) => !run.grade && !run.harnessError && !run.scenarioFailure).length,
    responseLatencyMs: { samples: gaps.length, p50: percentile(gaps, .5), p90: percentile(gaps, .9) },
    physicalPlayback: "unverified", backend: "disposable fixture, not production Eve tools" };
}
