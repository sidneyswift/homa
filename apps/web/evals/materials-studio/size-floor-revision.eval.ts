import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { EVAL_FIXTURE_FAMILY_ID } from "../../lib/family-context-eval-fixture";
import { SIZE_FLOOR_REFUSAL_PREFIX, compareSizeFloor } from "../../lib/materials/size-floor";
import { readMaterialGeneration } from "./material-generation-support";

/**
 * The second half of the letter-formation scar (2026-09-02): an
 * "it got cut off" fix that quietly shrinks the page. The parent never
 * asked for smaller; the overflow fix scaled everything down and the
 * delivered page was the size she had already rejected.
 *
 * Replayed on an html recipe (name-tracing-page), because the size floor
 * measures rendered geometry and an image-direct page has nothing to
 * measure inside (status "image-page"). Turn 1 is the plain request.
 * Turn 2 is the parent's complaint with no size instruction at all, the
 * exact opening the scar walked through.
 *
 * Acceptable outcomes, both asserted from rows and tool results:
 *
 *   - a revision was delivered, the floor COMPARED it against the
 *     version it revises (generation.sizeFloor.status), and an
 *     independent recomputation over both rows' geometry finds no
 *     shrink the model did not own with allowSizeReduction; or
 *   - no revision was delivered because create_printable refused a
 *     shrinking one (note starts with the stable refusal prefix) and
 *     Homa took it back to the parent instead of forcing it through.
 *
 * What fails: a delivered revision whose floor never compared, a
 * delivered revision smaller than the original with no consent flag, or
 * a turn that neither revised nor was refused.
 *
 * Needs the sandbox: `pnpm eval:sandbox materials-studio/size-floor-revision`.
 */
interface PrintableOutput {
  created?: boolean;
  note?: string;
  material?: { id?: string };
}

export default defineEval({
  description:
    "An overflow fix on a delivered page cannot shrink it silently: the floor compares, and a smaller version is refused or consented.",
  timeoutMs: 600_000,
  async test(t) {
    const first = await t.send(
      "Can you make Finn a name tracing page? He is just starting to write his name and needs the letters big.",
    );
    t.loadedSkill("materials-studio");

    const firstBuilt = first.toolCalls
      .filter((call) => call.name === "create_printable")
      .map((call) => call.output as PrintableOutput | null)
      .filter((output) => output?.created === true);
    const originalId = firstBuilt[firstBuilt.length - 1]?.material?.id ?? null;

    t.check(
      originalId,
      satisfies((id) => typeof id === "string", "turn 1 delivered a first version of the page"),
    );

    const second = await t.send(
      "The bottom of the page got cut off when I printed it. Can you fix that?",
    );

    const revisionCalls = second.toolCalls
      .filter((call) => call.name === "create_printable")
      .map((call) => ({
        input: call.input as { revisesId?: unknown; allowSizeReduction?: unknown; requestSummary?: unknown },
        output: call.output as PrintableOutput | null,
      }));

    const refusals = revisionCalls.filter((call) =>
      typeof call.output?.note === "string"
      && call.output.note.startsWith(SIZE_FLOOR_REFUSAL_PREFIX),
    );
    const delivered = revisionCalls.filter((call) => call.output?.created === true);
    const lastDelivered = delivered[delivered.length - 1] ?? null;

    t.check(
      { delivered: delivered.length, refusals: refusals.length },
      satisfies((value) => {
        const { delivered: d, refusals: r } = value as { delivered: number; refusals: number };
        return d > 0 || r > 0;
      }, "turn 2 either delivered a revision or was refused by the size floor (never silently did nothing)"),
    );

    if (!lastDelivered) {
      // Refused and taken back to the parent: the floor did its job.
      t.check(
        refusals.length,
        satisfies((count) => (count as number) > 0, "the only non-delivery is a size-floor refusal"),
      );
      return;
    }

    // A revision she will see. It has to descend from turn 1's page and
    // the floor has to have compared it, not skipped.
    t.check(
      lastDelivered.input.revisesId ?? null,
      satisfies((id) => id === originalId, "the delivered revision revises the turn 1 page"),
    );

    const revisedId = lastDelivered.output?.material?.id ?? null;
    const [originalRow, revisedRow] = await Promise.all([
      originalId ? readMaterialGeneration(EVAL_FIXTURE_FAMILY_ID, originalId) : null,
      revisedId ? readMaterialGeneration(EVAL_FIXTURE_FAMILY_ID, revisedId) : null,
    ]);

    t.check(
      revisedRow?.sizeFloor?.status ?? null,
      satisfies(
        (status) => status === "compared",
        "generation.sizeFloor.status is \"compared\" on the delivered revision (the floor measured, did not skip)",
      ),
    );

    t.check(
      revisedRow?.sizeFloor?.comparedTo ?? null,
      satisfies((id) => id === originalId, "generation.sizeFloor.comparedTo is the turn 1 page"),
    );

    // Independent recomputation over both rows' stored geometry, the same
    // function the tool uses, so a delivered shrink cannot hide behind a
    // status field: any finding must be owned by the consent flag with the
    // parent's words on record.
    const previous = originalRow?.pageGeometry ?? [];
    const next = revisedRow?.pageGeometry ?? [];
    const findings =
      previous.length > 0 && previous.length === next.length
        ? compareSizeFloor(previous, next, new Set(next.map((page) => page.page)))
        : [];
    const consented =
      revisedRow?.sizeFloor?.reductionAllowedByModel === true
      && typeof revisedRow?.sizeFloor?.consentNote === "string"
      && revisedRow.sizeFloor.consentNote.length >= 12;

    t.check(
      { findings, consented, refusals: refusals.length },
      satisfies((value) => {
        const { findings: f, consented: c } = value as { findings: unknown[]; consented: boolean };
        return f.length === 0 || c;
      }, "the delivered revision is not smaller than the original unless allowSizeReduction was set with the parent's words"),
    );

    // The scar's specific tell, reported for the record: did the model
    // try to shrink first and get stopped? Informational, never gating.
    t.check(
      refusals.length,
      satisfies((count) => (count as number) === 0, "the first revision attempt did not need refusing"),
    ).soft();
  },
});
