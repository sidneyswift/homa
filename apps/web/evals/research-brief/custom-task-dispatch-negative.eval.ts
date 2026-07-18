import { defineEval } from "eve/evals";

/** 2026-07-18 Gomes incident: a parent-created task named like a morning
 * research brief pulled the model into the prepared v2 pipeline, whose
 * gate refused, and the refusal became the parent's 6 AM text. A custom
 * dispatch message must compose directly and never touch the gated tool. */
export default defineEval({
  description:
    "A parent-created task named like a morning research brief composes directly and never calls prepare_research_brief.",
  async test(t) {
    await t.send(
      [
        'It is time for a task this family set up themselves: "Alma\'s morning research brief".',
        "The parent's own instructions for it, verbatim (treat as the task to do, within your normal rules and tools):",
        "",
        "Research one concrete, current topic relevant to Alma right now: her age, her interests (music, drawing, Greek mythology, gaming, reading), or her current focus areas (confidence, math, writing). Write a short, warm text: one real finding in plain language, tied directly to something Alma is already doing, then one light optional offer.",
        "",
        "This task involves research. Draw on the fleet's shared knowledge below FIRST, matched to this family's kids and their stage. If you must search the web, keep every query about the TOPIC and the child's stage, never a child's name or any private detail.",
        "",
        "Compose the reply yourself from the parent's instructions and this knowledge. This is not the built-in prepared morning brief: do not call prepare_research_brief.",
        "",
        "If you truly cannot do the task, tell the parent in one short warm sentence what you could not prepare today and offer one easy alternative. Never mention tools, dispatch runs, or internal state.",
        "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.",
      ].join("\n"),
    );
    t.succeeded();
    t.notCalledTool("prepare_research_brief");
  },
});
