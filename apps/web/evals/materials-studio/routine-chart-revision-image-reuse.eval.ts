import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

function imageCalls(turn: { toolCalls: readonly { name: string }[] }): number {
  return turn.toolCalls.filter((call) => call.name === "generate_image").length;
}

function createdPrintable(turn: {
  toolCalls: readonly { name: string; output?: unknown }[];
}): boolean {
  return turn.toolCalls.some((call) => {
    const output = call.output as { created?: unknown } | null;
    return call.name === "create_printable" && output?.created === true;
  });
}

/**
 * Production-derived regression for Carolyng's 2026-08-03 routine-chart
 * incident. The initial request used an icon per chore, then ordinary
 * language and layout corrections were handled as fresh image work. The
 * product result was a 30-image day, although these are visual-schedule
 * sheets with a one-composition art plan.
 *
 * This must stay multi-turn. A single opening prompt can look correct while
 * later text and layout corrections reintroduce the costly fan-out.
 *
 * Run with:
 * `pnpm eval:sandbox materials-studio/routine-chart-revision-image-reuse`
 */
export default defineEval({
  description:
    "A routine chart uses one composed visual plan, and text or layout revisions reuse its art.",
  timeoutMs: 600_000,
  async test(t) {
    const opening = await t.send(
      "Make Maya an evening routine chart with this exact sequence: dinner, wipe the table, bath, brush teeth, pajamas, read aloud, lights out. Use object-only picture cards, not children, with exact Spanish labels and a checkbox on every card.",
    );

    t.loadedSkill("materials-studio");
    t.check(
      createdPrintable(opening),
      satisfies(
        (created) => created === true,
        "the opening routine request produced a printable",
      ),
    );
    t.check(
      imageCalls(opening),
      satisfies(
        (count) => (count as number) <= 1,
        "a routine chart uses HTML or one shared composed visual-schedule image, never individual icon generations",
      ),
    );

    const languageRevision = await t.send(
      "The pictures are perfect. Keep every illustration exactly as it is. Change only the Spanish label for read aloud to \"Leer juntos\" and make the labels a little larger.",
    );
    t.check(
      createdPrintable(languageRevision),
      satisfies(
        (created) => created === true,
        "the language revision produced a printable",
      ),
    );
    t.check(
      imageCalls(languageRevision),
      satisfies(
        (count) => (count as number) === 0,
        "a label and type-size revision reuses the existing art",
      ),
    );

    const layoutRevision = await t.send(
      "Make a new finished printable version now. Keep the art exactly as it is. Move every checkbox below its label, put bath before pajamas, and add a blank notes line at the bottom of the chart.",
    );
    t.log(
      `layout revision tools=${layoutRevision.toolCalls.map((call) => call.name).join(",") || "none"}; reply=${JSON.stringify(layoutRevision.message ?? "")}`,
    );
    t.check(
      createdPrintable(layoutRevision),
      satisfies(
        (created) => created === true,
        "the layout revision produced a printable",
      ),
    );
    t.check(
      imageCalls(layoutRevision),
      satisfies(
        (count) => (count as number) === 0,
        "a checkbox, ordering, and layout revision reuses the existing art",
      ),
    );
  },
});
