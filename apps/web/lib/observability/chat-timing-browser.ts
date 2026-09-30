import { CHAT_TIMING_HEADER, timingRecord, timingClockId } from "./chat-timing";

type BrowserTurn = { id: string; startedAt: number; turnId?: string; firstEvent: boolean; firstText: boolean; visible: boolean };
let current: BrowserTurn | undefined;
let installed = false;
const pending: Record<string, unknown>[] = [];
let flushing = false;
function recordBrowser(record: Record<string, unknown>): void {
  const stamped = { clockId: timingClockId(), ...record };
  timingRecord(stamped);
  if (pending.length < 5000) pending.push(stamped);
  else console.info("[chat-timing-upload]", "buffer-cap-exceeded");
}
async function flushBrowserTiming(): Promise<void> {
  if (flushing || !pending.length) return;
  flushing = true;
  const batch = pending.splice(0, 200);
  try {
    const response = await fetch("/api/chat/timing", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(batch), keepalive: true });
    if (!response.ok) console.info("[chat-timing-upload]", response.status);
  } catch { console.info("[chat-timing-upload]", "unavailable"); }
  finally { flushing = false; if (pending.length) void flushBrowserTiming(); }
}
export function browserTimingMark(name: string): void {
  if (!current) return;
  recordBrowser({ kind: "browser.mark", name, sendId: current.id, turnId: current.turnId, atMs: Date.now(), elapsedMs: performance.now() - current.startedAt, visibility: document.visibilityState });
  if (name === "answer.next_frame" || name === "send.finished") void flushBrowserTiming();
}
export function beginBrowserTiming(startedAt = performance.now()): string {
  current = { id: crypto.randomUUID(), startedAt, firstEvent: false, firstText: false, visible: false };
  browserTimingMark("send.begin");
  return current.id;
}
export function browserTimingEvent(event: { type: string; data?: unknown }): void {
  if (!current) return;
  const data = (event.data ?? {}) as { turnId?: string; messageDelta?: string };
  if (!current.firstEvent) { current.firstEvent = true; browserTimingMark("stream.first_event"); }
  if (event.type === "turn.started") current.turnId = data.turnId;
  if (event.type === "message.appended" && data.messageDelta?.trim() && !current.firstText) {
    current.turnId = data.turnId; current.firstText = true; browserTimingMark("stream.first_answer_text");
  }
  if (["turn.started", "step.started", "actions.requested", "action.result", "turn.completed", "turn.failed", "session.failed"].includes(event.type)) browserTimingMark(`stream.${event.type}`);
}
/** Called after React commits; visibility is verified again at the next animation frame. */
export function browserTimingRendered(): void {
  const turn = current;
  if (!turn?.firstText || turn.visible || !turn.turnId) return;
  const selector = `[data-chat-timing-message="${CSS.escape(turn.turnId + ":assistant")}"] div.leading-relaxed.text-body`;
  const answer = document.querySelector(selector);
  if (!answer?.textContent?.trim()) return;
  const rect = answer.getBoundingClientRect();
  const style = getComputedStyle(answer);
  if (document.visibilityState !== "visible" || style.visibility === "hidden" || style.display === "none" || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight) return;
  let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
  let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
  for (let parent = answer.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
    if (css.visibility === "hidden" || css.display === "none" || Number(css.opacity) === 0) return;
    if (css.overflowX !== "visible") { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (css.overflowY !== "visible") { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  if (right <= left || bottom <= top) return;
  turn.visible = true;
  browserTimingMark("answer.dom_visible");
  requestAnimationFrame(() => {
    if (current === turn && document.visibilityState === "visible") browserTimingMark("answer.next_frame");
  });
}
/** Instrument only Homa chat requests, preserving the body and cancellation signal. */
export function installBrowserTiming(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const fetcher = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    const observed = current;
    if (!observed || url.origin !== location.origin || !(url.pathname.startsWith("/eve/") || url.pathname === "/api/chat/session-binding")) return fetcher(input, init);
    const name = url.pathname === "/api/chat/session-binding" ? "binding" : "eve";
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(CHAT_TIMING_HEADER, observed.id);
    const start = performance.now();
    recordBrowser({kind:"browser.request.start", name, sendId: observed.id, atMs:Date.now(), elapsedMs:start-observed.startedAt});
    try {
      const response = await fetcher(input, { ...init, headers });
      recordBrowser({kind:"browser.request.headers",name,sendId:observed.id,atMs:Date.now(),elapsedMs:performance.now()-observed.startedAt,durationMs:performance.now()-start,status:response.status, ...(response.headers.has("x-homa-timing-received") ? {serverReceivedMs:Number(response.headers.get("x-homa-timing-received")),serverHeadersMs:Number(response.headers.get("x-homa-timing-headers"))} : {})});
      return response;
    } catch(error) {
      recordBrowser({kind:"browser.request.error",name,sendId:observed.id,atMs:Date.now(),elapsedMs:performance.now()-observed.startedAt,durationMs:performance.now()-start});
      throw error;
    }
  };
  document.addEventListener("scroll", browserTimingRendered, { capture: true, passive: true });
  document.addEventListener("visibilitychange", browserTimingRendered);
  const observer = new MutationObserver(browserTimingRendered);
  observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
}

export function timeBrowserSync<T>(name: string, operation: () => T): T {
  const turn = current, start = performance.now(), atMs = Date.now();
  try { return operation(); }
  finally {
    if (turn) recordBrowser({kind:"browser.span", name, sendId:turn.id, atMs, elapsedMs:start-turn.startedAt, durationMs:performance.now()-start});
  }
}
