import { defineEval } from "eve/evals";

/**
 * Recipe provenance reaches the tool (2026-09-02). create_printable's
 * `recipe` input is how the studio measures each format and how the
 * reviewer gets the format's checklist and anchor, so a build that read
 * the flash-cards recipe and then omitted the slug would leave the
 * material unmeasurable and the reviewer without its spec. The skill's
 * Format library section asks for the slug on every call for a material.
 *
 * Conditional on purpose, the way anchor-usage.eval.ts is: the invariant
 * is "every create_printable call in a flash-card build carries the
 * flash-cards slug", vacuously true when no build happened, because eval
 * sessions sometimes honestly abort before create_printable and that is
 * not a provenance failure.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/recipe-provenance`.
 */
export default defineEval({
  description:
    "Every create_printable call in a flash-card build carries the flash-cards recipe slug.",
  timeoutMs: 600_000,
  async test(t) {
    const turn = await t.send(
      "Can you make Maya a set of flashcards for her eight sight words this week: the, and, said, was, you, they, of, to?",
    );
    t.loadedSkill("materials-studio");
    t.eventsSatisfy(
      "every create_printable call carried recipe flash-cards",
      () =>
        turn.toolCalls
          .filter((call) => call.name === "create_printable")
          .every((call) => call.input.recipe === "flash-cards"),
    );
  },
});
