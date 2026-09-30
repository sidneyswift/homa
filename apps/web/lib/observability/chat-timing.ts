/** Timing metadata only. No message text, tool arguments, URLs, or credentials. */
export const CHAT_TIMING_HEADER = "x-homa-timing-id";
export interface TimingIdentity {
  sendId?: string;
  sessionId?: string;
  turnId?: string;
  stepIndex?: number;
}
export function timingId(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value) ? value : undefined;
}
const clockKey = Symbol.for("homa.chat-timing.clock");
export function timingClockId(): string {
  const target = globalThis as typeof globalThis & { [clockKey]?: string };
  return target[clockKey] ??= crypto.randomUUID();
}
type TimingBuffer = { records: Record<string, unknown>[]; bytes: number; timer?: ReturnType<typeof setTimeout> };
const bufferKey = Symbol.for("homa.chat-timing.buffer");
const recordKey = Symbol.for("homa.chat-timing.record");
const flushKey = Symbol.for("homa.chat-timing.flush");
const shared = globalThis as typeof globalThis & {
  [bufferKey]?: TimingBuffer;
  [recordKey]?: typeof timingRecord;
  [flushKey]?: typeof flushTimingRecords;
};
export function flushTimingRecords(): void {
  const buffer = shared[bufferKey];
  if (!buffer?.records.length) return;
  if (buffer.timer) clearTimeout(buffer.timer);
  const records = buffer.records.splice(0); buffer.bytes = 0; buffer.timer = undefined;
  try { console.info("[chat-timing]", JSON.stringify({ version: 1, kind: "batch", records })); } catch { /* Observing must not fail a turn. */ }
}
/** Batch individual records so platform per-request log limits do not discard later operations. */
export function timingRecord(record: Record<string, unknown>): void {
  try {
    const stamped = { version: 1, clockId: timingClockId(), ...record };
    if (typeof window !== "undefined") { console.info("[chat-timing]", JSON.stringify(stamped)); return; }
    shared[recordKey] = timingRecord; shared[flushKey] = flushTimingRecords;
    const buffer = shared[bufferKey] ??= { records: [], bytes: 0 };
    const bytes = JSON.stringify(stamped).length;
    if (buffer.bytes + bytes > 16000) flushTimingRecords();
    buffer.records.push(stamped); buffer.bytes += bytes;
    if (buffer.records.length >= 40) flushTimingRecords();
    else if (!buffer.timer) {
      buffer.timer = setTimeout(flushTimingRecords, 200);
      buffer.timer.unref?.();
    }
  } catch { /* Observing must not fail a turn. */ }
}
export function timingIdentity(input: TimingIdentity): TimingIdentity {
  return {
    ...(timingId(input.sendId) ? { sendId: input.sendId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.turnId ? { turnId: input.turnId } : {}),
    ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
  };
}
export function timingMark(name: string, identity: TimingIdentity = {}): void {
  timingRecord({ kind: "mark", name, atMs: Date.now(), ...timingIdentity(identity) });
}
