import { defineEvalConfig } from "eve/evals";

/**
 * No shared judge or reporter yet: the fleet-skill routing evals below are
 * fully deterministic (t.loadedSkill / t.notCalledTool), so there is
 * nothing for an LLM judge to grade. Add judge/reporters here if a future
 * eval needs fuzzy or shared-result grading.
 */
export default defineEvalConfig({});
