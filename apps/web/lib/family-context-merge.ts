function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableKey(value: unknown): string {
  return JSON.stringify(value);
}

function mergeValue(target: unknown, source: unknown): unknown {
  if (source === undefined || source === null) return target;
  if (Array.isArray(target) && Array.isArray(source)) {
    const seen = new Set(target.map(stableKey));
    return [
      ...target,
      ...source.filter((item) => {
        const key = stableKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
  }
  if (isRecord(target) && isRecord(source)) {
    return mergeFamilyContextBags(target, source);
  }
  return source;
}

export function mergeFamilyContextBags(
  target: Record<string, unknown> | null | undefined,
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(target ?? {}) };
  for (const [key, value] of Object.entries(source ?? {})) {
    merged[key] = mergeValue(merged[key], value);
  }
  return merged;
}
