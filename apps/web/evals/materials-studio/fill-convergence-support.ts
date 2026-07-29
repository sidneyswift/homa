import { geometryToolNotes, type PageGeometry } from "../../lib/materials/page-geometry";

/**
 * Shared support for the materials-studio "fill convergence" eval set
 * (docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md).
 *
 * Each eval in this set replays a REAL parent revision saga (paraphrased
 * onto the Walker fixture family; the real transcripts and family id live
 * only in the doc above, never here) and measures how many turns it takes
 * before create_printable's OWN verdict says the page is fine: no measured
 * fill/overflow problem (gh#349's page-geometry feedback) and no reviewer
 * objection. That is a narrower, more honest target than "the parent
 * stops complaining": it is the exact signal the 2026-07-29 fixes
 * (worksheet-scale-to-fill ruling, geometry feedback, gh#349) were built
 * to make available on turn one, without needing a parent to say
 * "still blank" five times first.
 *
 * Not a general framework for scoring materials-studio quality: this file
 * only understands the fill/overflow defect class. A future defect class
 * (wrong subject, wrong character, wrong difficulty) needs its own usable
 * predicate; the runConvergenceScenario loop below is reusable as-is, the
 * predicate is not.
 */

interface CreatePrintableGeometryOutput {
  created?: boolean;
  material?: { pageGeometry?: PageGeometry[] };
  review?: { pass: boolean; issues: readonly string[] } | null;
}

export interface ConvergenceStep {
  /** 1-based, the way a parent counts her own turns. */
  turnIndex: number;
  parentText: string;
  /** False when this turn produced no create_printable call at all
   * (a clarifying question, an off-topic reply, or a call that never
   * resolved): not usable, but also not a fill/overflow finding. */
  built: boolean;
  reviewPass: boolean | null;
  /** The exact notes create_printable would append to its own result;
   * empty means no measured fill or overflow problem on any page. */
  geometryIssues: readonly string[];
  usable: boolean;
}

/**
 * usable = the tool's own deterministic verdict is clean. Mirrors
 * production exactly (geometryToolNotes is the same function
 * create_printable calls), so this can never drift from what Homa is
 * actually told. A null review (off, timed out, errored) does not block:
 * it is a separate, already-covered failure mode, and this eval set
 * exists to score the geometry fix, not review uptime.
 */
export function evaluateCreatePrintableOutput(
  output: CreatePrintableGeometryOutput | null | undefined,
): { usable: boolean; geometryIssues: readonly string[]; reviewPass: boolean | null } {
  if (!output?.created) {
    return { usable: false, geometryIssues: [], reviewPass: null };
  }
  const geometryIssues = geometryToolNotes(output.material?.pageGeometry ?? []);
  const reviewPass = output.review?.pass ?? null;
  return { usable: geometryIssues.length === 0 && reviewPass !== false, geometryIssues, reviewPass };
}

/** Minimal shape runConvergenceScenario needs from an EveEvalContext/Turn. */
export interface ConvergenceDriver {
  send(text: string): Promise<{
    toolCalls: readonly { name: string; output: unknown }[];
  }>;
}

/**
 * Sends a scripted transcript one turn at a time (turn 1 is always the
 * plain opening request, carrying no complaint; turns 2+ are the real
 * parent's own revision-round wording, paraphrased onto the fixture
 * child), stopping the FIRST time create_printable's result is usable.
 *
 * Stops early on success so a fixed system is cheap to eval (one model
 * turn, not the whole historical saga); runs the full list when the
 * defect is not fixed, which is exactly the signal a regression should
 * produce (every step recorded, none usable).
 */
export async function runConvergenceScenario(
  driver: ConvergenceDriver,
  turns: readonly string[],
): Promise<ConvergenceStep[]> {
  const steps: ConvergenceStep[] = [];
  for (const [index, parentText] of turns.entries()) {
    const turn = await driver.send(parentText);
    const printableCalls = turn.toolCalls.filter((call) => call.name === "create_printable");
    const latest = printableCalls[printableCalls.length - 1]?.output as
      | CreatePrintableGeometryOutput
      | undefined;
    const { usable, geometryIssues, reviewPass } = evaluateCreatePrintableOutput(latest ?? null);
    steps.push({
      turnIndex: index + 1,
      parentText,
      built: printableCalls.length > 0,
      reviewPass,
      geometryIssues,
      usable,
    });
    if (usable) break;
  }
  return steps;
}

/** 1-based turn a scenario converged at, or null if it never did. */
export function convergedAtTurn(steps: readonly ConvergenceStep[]): number | null {
  return steps.find((step) => step.usable)?.turnIndex ?? null;
}

/** Human-readable trace for console.error, same spirit as voice/live-conversation.eval.ts. */
export function printConvergenceTrace(label: string, steps: readonly ConvergenceStep[]): void {
  console.error(`\n── fill convergence: ${label} ─────────`);
  for (const step of steps) {
    const status = step.usable
      ? "USABLE"
      : !step.built
        ? "no create_printable call"
        : step.geometryIssues.length > 0
          ? `fill/overflow issue: ${step.geometryIssues.join(" ")}`
          : step.reviewPass === false
            ? "review flagged (non-geometry)"
            : "not usable";
    console.error(`  turn ${step.turnIndex}: "${step.parentText.slice(0, 70)}" -> ${status}`);
  }
  const at = convergedAtTurn(steps);
  console.error(at !== null ? `  converged at turn ${at}\n` : `  never converged in ${steps.length} turns\n`);
}
