import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_PACKET_ID,
  EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE,
  EVAL_FIXTURE_PACKET_PAGES,
  evalFixturePacketPageMarker,
} from "../../lib/family-context-eval-fixture";
import { getMaterialPinned } from "../../lib/materials/library";
import { splitPageBodies } from "../../lib/materials/page-shell";

/**
 * Revising one page of a packet produces a packet whose other pages are
 * byte-identical to the ones that were already there.
 *
 * The behavior this guards is plans/2026-07-27-packet-page-revision-failure.md.
 * A parent asked four times in fifteen minutes for one image on page 4
 * of a twelve-page packet to be bigger. There was no way to say "change
 * page 4, keep the other eleven", so the only path was re-emitting all
 * twelve pages of html as arguments: about 45KB, 24-38k output tokens
 * and minutes per attempt. One retry spent 28,117 output tokens and
 * produced no parseable tool call, after which Homa told her three times
 * there was a technical problem, having never called the tool.
 *
 * GRADE BOTH THE DOCUMENT AND THE COST. Neither axis alone works, and
 * both were measured against pre-fix code rather than reasoned about:
 *
 *   arguments only  passed 2/2 against broken code (see below)
 *   artifact only   passed 1/2 against broken code, because the old
 *                   path is intermittently correct: retyping twelve
 *                   pages CAN produce a perfect packet, it just costs
 *                   ~45KB and minutes and often fails outright
 *   both            the two pre-fix outcomes fail on different gates,
 *                   created:false on one and argument size on the other
 *
 * That is the real shape of this fix: the old path was not reliably
 * WRONG, it was reliably EXPENSIVE, and expensive is what stranded a
 * parent four times in fifteen minutes. An eval that only asks "is the
 * output correct" is blind to the defect half the time.
 *
 * The first version of this eval
 * asserted on create_printable's INPUT: eleven entries carrying
 * fromMaterialId plus pageIndex, one carrying html, under 20KB. It
 * passed 4/4 with the fix. It also passed 2/2 with pageIndex stripped
 * out of both tools, which is the state the bug shipped in, because the
 * skill still told Homa to send pageIndex and the assertions read what
 * she EMITTED. Zod dropped the unknown key before execution, so each of
 * the eleven references expanded to the whole twelve-page material and
 * the build blew the page cap; create_printable was still "called", so
 * the gate held. An eval that reads tool arguments measures the model's
 * intent. Only the artifact measures whether the mechanism works.
 *
 * So: read the material the tool actually wrote and compare it page by
 * page against the seeded original. Every page carries a marker, so a
 * page that was silently regenerated from the model's memory of it
 * fails even when it looks plausible.
 *
 * Needs the sandbox for its seeded packet and a real database:
 * `pnpm eval:sandbox materials-studio/packet-page-revision`.
 */
export default defineEval({
  description:
    "Revising one page of a twelve-page packet leaves the other eleven byte-identical.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      `The woodland animals on page ${EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE} of Maya's Letter Sounds Workbook are too small for her to color. Can you make them bigger? Everything else in the packet is great, leave it alone.`,
    );
    t.loadedSkill("materials-studio");

    // The build has to have SUCCEEDED, not merely been attempted. The
    // pre-fix run called create_printable and got back created:false
    // (page cap blown); "was it called" cannot tell those apart.
    t.calledTool("create_printable", {
      output: (value) => (value as { created?: unknown } | null)?.created === true,
    });

    t.check(
      turn.toolCalls.filter((call) => call.name === "generate_image").length,
      satisfies(
        (count) => count === 0,
        "a size-only revision reused the existing art instead of generating replacement pixels",
      ),
    );

    const built = turn.toolCalls
      .filter((call) => call.name === "create_printable")
      .map((call) => call.output as { created?: boolean; material?: { id?: string } } | null)
      .find((output) => output?.created === true);

    const producedId = built?.material?.id;
    const produced = producedId
      ? await getMaterialPinned(EVAL_FIXTURE_FAMILY_ID, producedId)
      : null;
    const pages = produced?.html ? splitPageBodies(produced.html) : [];

    // COST, not just correctness. Measured 2026-07-27: with the artifact
    // gates alone this eval caught pre-fix code only 1 run in 2, because
    // the old path is INTERMITTENTLY correct. Re-emitting twelve pages
    // can produce a perfect packet; it just costs ~45KB of arguments and
    // minutes, and fails often enough to strand a parent. Both pre-fix
    // outcomes have to be caught, and they fail differently:
    //
    //   the model sends compact references the schema ignores
    //     -> every reference expands to the whole material, page cap
    //        blown, created:false, caught by the assertion above
    //   the model retypes all twelve pages faithfully
    //     -> a correct artifact, caught only here, by its size
    //
    // Size is the honest discriminator: it cannot be faked by a model
    // emitting a key the schema drops, which is exactly how the first
    // version of this eval was fooled into passing against broken code.
    const buildArgChars = Math.min(
      ...turn.toolCalls
        .filter((call) => call.name === "create_printable")
        .map((call) => JSON.stringify(call.input ?? {}).length),
    );

    t.check(
      buildArgChars,
      satisfies(
        (chars) => (chars as number) < 20_000,
        "the rebuild was emitted as a small call, not a retyped packet",
      ),
    );

    t.check(
      pages.length,
      satisfies(
        (count) => count === EVAL_FIXTURE_PACKET_PAGES,
        `the rebuilt packet has exactly ${EVAL_FIXTURE_PACKET_PAGES} pages`,
      ),
    );

    // Every page still sits at its own number. Reusing a whole material
    // per entry (the pre-fix behavior) duplicates page 1 across the
    // document, which this catches even if the count somehow matched.
    // The revised page is exempt: Homa rewrites it, and nothing ever told
    // her to carry an internal data-marker through a rewrite. Demanding
    // it made this gate fail 1 run in 3 for a page that was otherwise
    // perfect, which is a test inventing a requirement the product does
    // not have. The unchanged pages are where position actually matters,
    // and they are what whole-material reuse scrambles.
    t.check(
      pages,
      satisfies(
        (value) =>
          (value as string[]).every(
            (body, index) =>
              index + 1 === EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE
              || body.includes(evalFixturePacketPageMarker(index + 1)),
          ),
        "every unchanged page kept its own position marker",
      ),
    );

    // The point of the whole change: the untouched pages are the ORIGINAL
    // bytes, not a retyped approximation.
    // The seeded packet is what the revision descends from.
    const original = await getMaterialPinned(
      EVAL_FIXTURE_FAMILY_ID,
      EVAL_FIXTURE_PACKET_ID,
    );
    const originalPages = original?.html ? splitPageBodies(original.html) : [];

    t.check(
      { pages, originalPages },
      satisfies((value) => {
        const { pages: got, originalPages: want } = value as {
          pages: string[];
          originalPages: string[];
        };
        if (got.length !== want.length || want.length === 0) return false;
        return got.every((body, index) =>
          index + 1 === EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE
            ? true
            : body === want[index],
        );
      }, "every page except the revised one is byte-identical to the original"),
    );

    // And the revised page genuinely changed, so a no-op rebuild that
    // preserves everything cannot pass by doing nothing.
    t.check(
      { pages, originalPages },
      satisfies((value) => {
        const { pages: got, originalPages: want } = value as {
          pages: string[];
          originalPages: string[];
        };
        const index = EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE - 1;
        return got[index] !== undefined && got[index] !== want[index];
      }, "the page she asked about actually changed"),
    );
  },
});
