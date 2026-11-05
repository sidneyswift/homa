import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * The adversarial negative for background-first-making-no-evidence
 * (gh#1252). The background rule lets a build with no parent present
 * pick a conservative level and build. It must not leak into a live
 * conversation: here Rachel is right there, and the Walker fixture holds
 * no math evidence for Maya (her saved focus is letter sounds and early
 * reading), so a subtraction page still opens with ONE calibrating
 * question and nothing is generated yet.
 *
 * The question may arrive as reply text or as a structured ask_question
 * input request (a parked run); either is the interactive rule working.
 *
 * Run with:
 * `pnpm eval:sandbox materials-studio/interactive-no-evidence-asks`
 */
export default defineEval({
  description:
    "In a live conversation with no evidence for the skill, Homa asks one calibrating question before generating a material.",
  tags: ["model-backed", "materials-studio"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send("Can you make Maya a subtraction worksheet?");
    t.log(
      JSON.stringify({
        phase: "settled-turn-before-assertions",
        response: t.reply,
        tools: turn.toolCalls.map((call) => call.name),
      }),
    );

    t.notCalledTool("create_printable");
    t.notCalledTool("generate_image");
    t.notCalledTool("report_agent_job_stage");

    const askedStructured = turn.inputRequests.length > 0;
    const askedInText = (turn.message ?? "").includes("?");
    t.check(
      askedStructured || askedInText,
      satisfies(
        (value) => value === true,
        "Homa asked the parent a calibrating question",
      ),
    );
  },
});
