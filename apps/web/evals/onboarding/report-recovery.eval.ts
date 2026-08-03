import { defineEval } from "eve/evals";

/**
 * The activation handoff begins after a report is scored, not at account
 * creation. A parent who asks where that report went should get the actual
 * report surface back, without being told to search the app or their email.
 *
 * Needs the sandbox because open_progress_report verifies a real report row:
 * `pnpm eval:sandbox onboarding/report-recovery`.
 */
export default defineEval({
  description:
    "A parent who loses a scored report can reopen it directly from the conversation.",
  async test(t) {
    const turn = await t.send("Where is Maya's report?");
    turn.expectOk();

    const opened = turn.toolCalls
      .filter((call) => call.name === "open_progress_report")
      .map((call) => call.output as { opened?: unknown; childName?: unknown } | null)
      .filter((output) => output?.opened === true && output.childName === "Maya");

    t.eventsSatisfy(
      "the report recovery tool opened Maya's real family-scoped report",
      () => opened.length > 0,
    );
  },
});
