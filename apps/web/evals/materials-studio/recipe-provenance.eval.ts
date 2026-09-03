import { defineEval } from "eve/evals";

/**
 * Recipe provenance reaches the tool (2026-09-02). create_printable's
 * `recipe` input is how the studio measures each format and how the
 * reviewer gets the format's checklist and anchor, so a build that read
 * the flash-cards recipe and then omitted the slug would leave the
 * material unmeasurable and the reviewer without its spec. The skill's
 * Format library section asks for the slug on every call for a material;
 * this eval checks the ask is honored on the first draft.
 *
 * Conditional on purpose, like anchor-usage.eval.ts: the invariant is
 * "when a flash-card build reaches create_printable, it carries the
 * flash-cards slug", not "the build always happens". The partial-deep
 * matcher on input ignores every other field.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/recipe-provenance`.
 */
export default defineEval({
  description:
    "A flash-card build passes the flash-cards recipe slug to create_printable.",
  timeoutMs: 600_000,
  async test(t) {
    await t.send(
      "Can you make Maya a set of flashcards for her eight sight words this week: the, and, said, was, you, they, of, to?",
    );
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable", { input: { recipe: "flash-cards" } });
  },
});
