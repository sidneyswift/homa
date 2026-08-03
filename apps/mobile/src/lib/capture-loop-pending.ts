import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingNativeScheduleOutcome {
  loopId: string;
  receiptId: string;
}

export interface PendingOutcomeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type NativeScheduleOutcomeVerifier = (
  loopId: string,
  receiptId: string,
) => Promise<boolean>;

const STORAGE_PREFIX = "homa:capture-loop-outcome:v1";
const MAX_PENDING_OUTCOMES = 32;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const mutations = new Map<string, Promise<void>>();

function storageKey(familyId: string): string {
  return `${STORAGE_PREFIX}:${familyId}`;
}

function isPendingOutcome(value: unknown): value is PendingNativeScheduleOutcome {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.loopId === "string"
    && UUID_RE.test(candidate.loopId)
    && typeof candidate.receiptId === "string"
    && UUID_RE.test(candidate.receiptId)
  );
}

function parsePending(raw: string | null): PendingNativeScheduleOutcome[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingOutcome).slice(-MAX_PENDING_OUTCOMES);
  } catch {
    return [];
  }
}

async function readPending(
  familyId: string,
  storage: PendingOutcomeStorage,
): Promise<PendingNativeScheduleOutcome[]> {
  return parsePending(await storage.getItem(storageKey(familyId)));
}

async function mutatePending(
  familyId: string,
  update: (current: PendingNativeScheduleOutcome[]) => PendingNativeScheduleOutcome[],
  storage: PendingOutcomeStorage,
): Promise<void> {
  const key = storageKey(familyId);
  const prior = mutations.get(key) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(async () => {
    const updated = update(await readPending(familyId, storage));
    if (updated.length === 0) {
      await storage.removeItem(key);
    } else {
      await storage.setItem(key, JSON.stringify(updated.slice(-MAX_PENDING_OUTCOMES)));
    }
  });
  mutations.set(key, next);
  try {
    await next;
  } finally {
    if (mutations.get(key) === next) mutations.delete(key);
  }
}

export async function loadPendingNativeScheduleOutcomes(
  familyId: string,
  storage: PendingOutcomeStorage = AsyncStorage,
): Promise<PendingNativeScheduleOutcome[]> {
  return readPending(familyId, storage);
}

export async function rememberPendingNativeScheduleOutcome(
  familyId: string,
  pending: PendingNativeScheduleOutcome,
  storage: PendingOutcomeStorage = AsyncStorage,
): Promise<void> {
  if (!UUID_RE.test(pending.loopId) || !UUID_RE.test(pending.receiptId)) {
    throw new Error("Pending capture-loop pointers must be UUIDs.");
  }
  await mutatePending(
    familyId,
    (current) => [
      ...current.filter((item) => item.loopId !== pending.loopId),
      pending,
    ],
    storage,
  );
}

export async function forgetPendingNativeScheduleOutcome(
  familyId: string,
  loopId: string,
  storage: PendingOutcomeStorage = AsyncStorage,
): Promise<void> {
  await mutatePending(
    familyId,
    (current) => current.filter((item) => item.loopId !== loopId),
    storage,
  );
}

export async function reconcilePendingNativeScheduleOutcomes(
  familyId: string,
  verify: NativeScheduleOutcomeVerifier,
  storage: PendingOutcomeStorage = AsyncStorage,
): Promise<void> {
  const pending = await loadPendingNativeScheduleOutcomes(familyId, storage);
  for (const item of pending) {
    try {
      if (await verify(item.loopId, item.receiptId)) {
        await forgetPendingNativeScheduleOutcome(familyId, item.loopId, storage);
      }
    } catch {
      // Recovery is opportunistic. Keep the pointer for the next focus.
    }
  }
}
