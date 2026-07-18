/**
 * Keeps the agent-jobs primitive dark until its additive migration has
 * landed (agent-jobs plan, ChildProgress-style flag-gated rollout). The
 * tool is the flag gate, not the skill: start_agent_job refuses cleanly
 * when this is off, so a curriculum-studio SKILL.md can ship before the
 * flag flips without leading the model into a dead tool call. Only the
 * exact documented value enables the tools.
 */
export function agentJobsEnabled(): boolean {
  return process.env.HOMA_AGENT_JOBS_ENABLED === "true";
}
