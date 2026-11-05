import { defineTool, type ToolContext, type ToolDefinition } from "eve/tools";
import type { z } from "zod";

import { prepareConversationOperation, executeConversationOperation, type PreparedConversationOperation } from "./conversation-operations";
import { requireConversationJobAccess } from "./conversation-jobs";
import { requireConversationRequestAccess } from "./conversation-request-access";

/**
 * Every tool answers, or it fails out loud (2026-07-23).
 *
 * eve 0.19.0 has no per-tool timeout and hands authored tools no abort
 * signal. Homa's local patch forwards the runtime call identity, but the
 * AI SDK's abortSignal still does not reach authored tool bodies. So one tool call
 * that never settles parks the whole turn forever. That is not
 * hypothetical. In production it has happened twice:
 *
 *   2026-07-19  3 find_materials calls (Swift family, session
 *               wrun_01KXY6DXK55C16XZCAM717V0GD, task "Story's alphabet
 *               pages, next batch"). The turn went silent at 22:21 and
 *               nothing noticed until the 2h task-run reaper failed it at
 *               01:01. The parent got nothing and re-ran the task by hand.
 *   2026-07-22  4 mark_material_final calls across 2 sessions.
 *
 * Seven stuck calls in 3155, both times on cheap database tools whose
 * p99 is under four seconds.
 *
 * Why the deadline lives here and not in Postgres or in eve:
 *
 *   - Postgres already has one. The pooler role runs with
 *     statement_timeout = 2min, so a merely slow query dies on its own.
 *     The 07-19 freeze ran 2h40m, so no backend query was running to
 *     cancel: the pooled connection simply stopped answering. Raising or
 *     lowering a server-side timeout cannot reach that.
 *   - Setting the timeout through the client does not work either. The
 *     Supabase transaction pooler accepts postgres.js's
 *     `connection: { statement_timeout }` startup parameters and then
 *     silently ignores them; a probe on 2026-07-23 read back the
 *     unchanged 2min. Code doing that would look like a fix and be a
 *     placebo.
 *   - Patching eve's harness would cover framework tools too, but the
 *     patch has to be re-derived at every version bump, and a pnpm
 *     version mismatch already drops this repo's eve patch silently.
 *     A safety net that can disappear without a signal is the wrong
 *     shape for a safety net.
 *
 * So the deadline is ours, it is declared per tool, and
 * scripts/tool-deadline-check.mts fails CI if a tool forgets to declare
 * one. A tool that blows its deadline throws: eve turns the throw into a
 * tool-error the model can see and recover from, record-tool-calls.ts
 * writes status='failed' with a finished_at, and the founder console
 * shows a failure instead of a row that never ends. Returning an
 * ordinary-looking empty result instead would be worse than the freeze,
 * because an empty find_materials reads as "the library is empty" and
 * sends the agent off to rebuild what it already has.
 *
 * The deadline bounds the wait, it does not cancel the work. Nothing
 * here can; there is no cancellation channel down to a socket that has
 * stopped replying. The abandoned promise is left with a catch attached
 * so its late rejection, minutes later when the socket finally errors,
 * cannot take the process down as an unhandled rejection.
 */

/** Thrown when a tool outruns its declared deadline. */
export class ToolDeadlineError extends Error {
  readonly deadlineMs: number;
  readonly repeatable: boolean;

  constructor(deadlineMs: number, repeatable: boolean) {
    // Written for the model, which is the only reader: eve turns this into
    // a tool-error in the transcript. It says what is true (we stopped
    // waiting) without claiming what is not. A write may well have landed
    // with only the reply lost, so "unknown" is the honest state and the
    // safe one to report.
    //
    // Whether a retry is safe is decided here, by the tool's own declared
    // `repeatable`, not left for the model to infer from the tool's name.
    // The first draft of this message said "try once more if the work is
    // cheap to repeat", which is an invitation to send a second text to a
    // real parent.
    super(
      `This tool did not answer within ${Math.round(deadlineMs / 1000)}s, so it was given up ` +
        "on. Whether its work finished is unknown. Do not tell the parent it is done and do " +
        "not assume it failed. " +
        (repeatable
          ? "This tool is safe to repeat: call it again."
          : "This tool is NOT safe to repeat, because it sends, spends, or saves something. " +
            "Do not call it again. Say plainly that you could not confirm this step, and let " +
            "her decide what to do."),
    );
    this.name = "ToolDeadlineError";
    this.deadlineMs = deadlineMs;
    this.repeatable = repeatable;
  }
}

/** Thrown before a Homa tool body runs in a restricted autonomous task. */
export class ToolAccessBoundaryError extends Error {
  readonly channel: string;

  constructor(channel: string) {
    super(
      `This tool is not allowed in the restricted ${channel} task. Stop without trying another effect.`,
    );
    this.name = "ToolAccessBoundaryError";
    this.channel = channel;
  }
}

/**
 * Deadline tiers, in milliseconds. The numbers come from the real
 * latency of every completed call in public.agent_tool_calls as of
 * 2026-07-23 (n=3155), not from taste. Each tier sits far enough above
 * the slowest observed run of the tools in it that a healthy call can
 * never trip it, and low enough that a parent is not left waiting.
 *
 *   tier      slowest observed in tier   ceiling   headroom
 *   quick     13.9s (manage_child_progress)  45s    3.2x
 *   fetch     41.4s (web_fetch)              90s    2.2x
 *   render   105.2s (create_printable)      210s    2.0x
 *   generate 128.9s (generate_image)        240s    1.9x
 *
 * Re-derive these from production rather than adjusting them by feel;
 * scripts/tool-deadline-report.mts prints the same table.
 */
export const TOOL_DEADLINE = {
  /** Database reads and writes, and anything else that stays inside our
   * own infrastructure. Covers all but four of Homa's tools. */
  quick: 45_000,
  /** One call out to a third party that is not generating anything:
   * search, scrape, photo lookup, an outbound message. */
  fetch: 90_000,
  /** Headless-browser rendering, PDF composition, Blob uploads. */
  render: 210_000,
  /** Image and other model generation, the slowest legitimate work
   * Homa does inside a single tool call. */
  generate: 240_000,
} as const;

export type ToolDeadline = (typeof TOOL_DEADLINE)[keyof typeof TOOL_DEADLINE];

/**
 * Runs `work` and gives up after `deadlineMs`, throwing
 * {@link ToolDeadlineError}. Exported for direct use by non-tool agent
 * code (schedules, job stages) that has the same never-settles exposure.
 */
export async function withToolDeadline<T>(
  deadlineMs: number,
  work: () => Promise<T> | T,
  repeatable = false,
): Promise<T> {
  const running = (async () => await work())();
  // The race below stops awaiting this promise the moment the deadline
  // wins, so nothing is left to observe a rejection that arrives later.
  // Without this catch that late rejection is an unhandled rejection,
  // which ends the process and would turn one slow tool into an outage.
  running.catch(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      running,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new ToolDeadlineError(deadlineMs, repeatable)),
          deadlineMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Finish permission checks before entering the effect body. A late permission
 * result after timeout cannot resume an abandoned callback and start new work. */
export async function withAuthorizedToolDeadline<T>(
  deadlineMs: number, authorize: () => Promise<unknown>, execute: () => Promise<T> | T, repeatable: boolean,
): Promise<T> {
  const started = performance.now();
  await withToolDeadline(deadlineMs, authorize, true);
  const remaining = deadlineMs - (performance.now() - started);
  if (remaining <= 0) throw new ToolDeadlineError(deadlineMs, true);
  return withToolDeadline(remaining, execute, repeatable);
}

/**
 * defineTool with a mandatory deadline. Every file in agent/tools/ that
 * exports a tool uses this instead of eve's defineTool; the guard script
 * enforces it so a tool added next month cannot reintroduce the freeze.
 *
 * Typed against zod because every Homa tool declares a zod inputSchema.
 * A tool needing a raw JSON Schema should extend this rather than fall
 * back to a bare defineTool.
 */
export function defineBoundedTool<TSchema extends z.ZodType, TOutput>(definition: {
  description: string;
  inputSchema: TSchema;
  /** How long this tool may legitimately take. Prefer a TOOL_DEADLINE
   * tier; a bare number needs a comment saying what measured it. */
  deadlineMs: number;
  /**
   * May Homa call this again when the outcome is unknown?
   *
   * True only when a second call cannot reach the parent, cannot spend
   * money, and cannot leave a duplicate product record. Reads qualify.
   * Best-effort telemetry (usage events, gap logs) does not disqualify
   * one, since those writers are already duplicate-tolerant by design.
   *
   * Anything that texts, emails, generates, uploads, or inserts a row a
   * parent would see twice is false. When genuinely unsure, false: the
   * cost is Homa saying she could not confirm a step, and the cost of
   * being wrong the other way is a parent getting the same text twice.
   */
  repeatable: boolean;
  /**
   * Opts this exact tool into the autonomous Progress producer. Every other
   * Homa tool is denied before its body runs, regardless of prompt text.
   */
  allowProgressNextMove?: boolean;
  execute(input: z.output<TSchema>, ctx: ToolContext): Promise<TOutput> | TOutput;
  // Both mirror eve's own defineTool overload rather than restating the
  // shapes; ApprovalContextInput is conditional on TInput, so a hand-written
  // Approval<z.output<TSchema>> does not survive a still-generic TSchema.
  approval?: ToolDefinition<z.output<TSchema>, unknown>["approval"];
  toModelOutput?: ToolDefinition<unknown, TOutput>["toModelOutput"];
}): ToolDefinition<z.output<TSchema>, TOutput> {
  const {
    deadlineMs,
    repeatable,
    allowProgressNextMove = false,
    execute,
    ...rest
  } = definition;
  return defineTool({
    ...rest,
    async execute(input: z.output<TSchema>, ctx: ToolContext): Promise<TOutput> {
      if (
        ctx.session?.auth.current?.attributes.channel === "progress_next_move" &&
        !allowProgressNextMove
      ) {
        throw new ToolAccessBoundaryError("progress_next_move");
      }
      const authorizationStarted = performance.now();
      let operation: PreparedConversationOperation | null = null;
      return withAuthorizedToolDeadline(deadlineMs,
        async () => {
          const owner = ctx.session ? await requireConversationRequestAccess(ctx.session, "execute") : null;
          const jobOwner = ctx.session ? await requireConversationJobAccess(ctx.session, "execute") : null;
          if ((owner || jobOwner) && !repeatable) operation = await prepareConversationOperation(ctx, input, deadlineMs - (performance.now() - authorizationStarted));
        },
        () => operation ? executeConversationOperation(operation, () => execute(input, ctx)) : execute(input, ctx), repeatable);
    },
  }) as ToolDefinition<z.output<TSchema>, TOutput>;
}
