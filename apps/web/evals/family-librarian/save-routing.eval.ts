import { defineEval } from "eve/evals";

/**
 * Positive routing guard for promoting a previously shared chat attachment.
 * The fixture does not need a real attachment: finding the family-owned
 * attachment first is the required honest behavior when the target is named
 * only by description and date.
 */
export default defineEval({
  description:
    "Saving a previously shared worksheet loads family-librarian and searches attachments first.",
  async test(t) {
    const turn = await t.send(
      "Please save the woodland worksheet I attached yesterday in my Library.",
    );

    t.succeeded();
    t.loadedSkill("family-librarian");
    t.calledTool("find_attachments");
    t.eventsSatisfy(
      "a new printable was not created instead of saving the attachment",
      () => turn.toolCalls.every((call) => call.name !== "create_printable"),
    );
  },
});
