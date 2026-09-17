import { z } from "zod";

export const BROWSER_TIMING_NAMES = [
  "storage.read", "storage.write", "binding.retry_begin", "binding.retry_end",
  "send.begin", "send.finished", "session.lock_requested", "session.lock_acquired",
  "session.binding_begin", "session.binding_end", "eve.send_begin",
  "browser.auth_begin", "browser.auth_end", "stream.first_event", "stream.first_answer_text",
  "stream.turn.started", "stream.step.started", "stream.actions.requested", "stream.action.result",
  "stream.turn.completed", "stream.turn.failed", "stream.session.failed",
  "answer.dom_visible", "answer.next_frame", "binding", "eve",
] as const;
export const browserTimingBatch = z.array(z.object({
  clockId: z.string().uuid().optional(),
  kind: z.enum(["browser.span", "browser.mark", "browser.request.start", "browser.request.headers", "browser.request.error"]),
  name: z.enum(BROWSER_TIMING_NAMES), sendId: z.string().uuid(),
  turnId: z.string().regex(/^turn_[0-9]+$/).max(40).optional(),
  atMs: z.number().finite().nonnegative(), elapsedMs: z.number().finite().min(0).max(86_400_000),
  durationMs: z.number().finite().min(0).max(86_400_000).optional(),
  visibility: z.enum(["visible", "hidden"]).optional(), status: z.number().int().min(100).max(599).optional(),
  serverReceivedMs: z.number().finite().nonnegative().optional(), serverHeadersMs: z.number().finite().nonnegative().optional(),
}).strict()).min(1).max(200);
