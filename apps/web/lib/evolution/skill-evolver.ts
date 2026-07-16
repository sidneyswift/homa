import { adminDb } from "../admin/db";
import type { DetectedPattern } from "../signals/patterns";

/**
 * Layer 4: Skill Evolution.
 * Proposes and drafts skill updates based on detected signal patterns.
 * Records evolution history so the Night Manager can track what changed
 * and why.
 */

export interface SkillEvolutionEntry {
  id: string;
  patternId: string;
  skillName: string;
  changeType: string;
  diffSummary: string | null;
  prUrl: string | null;
  status: string;
  createdAt: string;
}

/**
 * Generate a skill update proposal from a detected pattern. Returns
 * a description the Night Manager can use to draft a PR.
 */
export function proposeSkillUpdate(pattern: DetectedPattern): {
  skillName: string;
  changeType: "create" | "update" | "instruction_update";
  description: string;
} {
  const signalToSkill: Record<string, string> = {
    confusion: "onboarding-guide",
    knowledge_gap: "research-brief",
    repeated_ask: "faq-handler",
    bug: "error-recovery",
    feature_request: "capability-expansion",
    churn_risk: "engagement-recovery",
    delight: "delight-amplifier",
  };

  const skillName = signalToSkill[pattern.signalType] ?? `${pattern.signalType}-handler`;
  const isNew = !signalToSkill[pattern.signalType];

  return {
    skillName,
    changeType: isNew ? "create" : "update",
    description: [
      `Pattern: ${pattern.patternDescription}`,
      `Evidence (${pattern.sampleEvidence.length} samples):`,
      ...pattern.sampleEvidence.map((e) => `  - ${e.slice(0, 200)}`),
      "",
      `Proposed: ${isNew ? "Create new" : "Update"} skill "${skillName}" to address this pattern.`,
    ].join("\n"),
  };
}

/**
 * Draft skill content based on a pattern and optional existing skill.
 * Returns markdown content for the skill file.
 */
export function draftSkillContent(
  pattern: DetectedPattern,
  existingSkill?: string,
): string {
  const lines = [
    `---`,
    `description: "Use when the conversation shows signs of ${pattern.signalType.replace(/_/g, " ")}."`,
    `---`,
    ``,
    `# ${pattern.signalType.replace(/_/g, " ")} handler`,
    ``,
    `## When to use`,
    ``,
    `This skill activates when the conversation shows ${pattern.signalType.replace(/_/g, " ")} signals.`,
    `Pattern detected across ${pattern.familyCount} families with ${pattern.occurrenceCount} occurrences.`,
    ``,
    `## Evidence`,
    ``,
    ...pattern.sampleEvidence.map((e) => `- ${e.slice(0, 200)}`),
    ``,
    `## Procedure`,
    ``,
    `1. Acknowledge the situation warmly`,
    `2. Address the specific concern`,
    `3. Offer a concrete next step`,
    ``,
  ];

  if (existingSkill) {
    lines.push(
      `## Previous version notes`,
      ``,
      `This skill was updated from a previous version. Review the diff for changes.`,
      ``,
    );
  }

  return lines.join("\n");
}

/**
 * Record a skill evolution event.
 */
export async function logEvolution(
  patternId: string,
  skillName: string,
  changeType: "create" | "update" | "instruction_update",
  diffSummary: string,
  prUrl?: string,
): Promise<string> {
  const db = adminDb();

  const [row] = await db<{ id: string }[]>`
    insert into public.skill_evolution_log
      (pattern_id, skill_name, change_type, diff_summary, pr_url)
    values (
      ${patternId}::uuid,
      ${skillName},
      ${changeType},
      ${diffSummary},
      ${prUrl ?? null}
    )
    returning id::text
  `;

  // Update the pattern status
  await db`
    update public.signal_patterns
    set status = 'skill_drafted'
    where id = ${patternId}::uuid
  `;

  return row!.id;
}

/**
 * Get recent skill evolution entries.
 */
export async function getEvolutionLog(limit = 20): Promise<SkillEvolutionEntry[]> {
  const db = adminDb();

  const rows = await db<
    {
      id: string;
      pattern_id: string;
      skill_name: string;
      change_type: string;
      diff_summary: string | null;
      pr_url: string | null;
      status: string;
      created_at: string;
    }[]
  >`
    select
      id::text,
      pattern_id::text,
      skill_name,
      change_type,
      diff_summary,
      pr_url,
      status,
      created_at::text
    from public.skill_evolution_log
    order by created_at desc
    limit ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    patternId: r.pattern_id,
    skillName: r.skill_name,
    changeType: r.change_type,
    diffSummary: r.diff_summary,
    prUrl: r.pr_url,
    status: r.status,
    createdAt: r.created_at,
  }));
}
