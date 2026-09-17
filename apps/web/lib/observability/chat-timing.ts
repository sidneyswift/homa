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
export function timingRecord(record: Record<string, unknown>): void {
  try { console.info("[chat-timing]", JSON.stringify({ version: 1, clockId: timingClockId(), ...record })); } catch { /* Observing must not fail a turn. */ }
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
