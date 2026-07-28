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

/**
 * Whether a finished material may ride along on the milestone text for a
 * family that is NOT a sandbox family (founder ruling
 * `voice-dispatch-sandbox-gate`, 2026-07-28).
 *
 * Off by default on purpose. Sandbox families always get the attachment, so
 * the whole path is verifiable end to end on +homatest without this flag,
 * and flipping it is the single deliberate step that opens delivery to real
 * families. The pair it guards is the reason: dispatched work auto-finalizes
 * to the binder once QC passes (ruling `voice-dispatch-delivery`), and the
 * 2026-07-24 materials review found QC screenshotting the screen render
 * while the print render is what ships. Auto-finalize plus untested delivery
 * puts a wrong worksheet in a real parent's binder, so the gate stays until
 * a real send has been watched.
 */
export function jobMaterialDeliveryEnabled(): boolean {
  return process.env.HOMA_JOB_MATERIAL_DELIVERY_ENABLED === "true";
}
