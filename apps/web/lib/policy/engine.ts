import { readFileSync } from "node:fs";
import path from "node:path";

import { adminDb } from "../admin/db";

/**
 * Layer 2: Policy Engine.
 * Self-modifying policy system with founder approval gates. Policies
 * live in the DB with fallback to POLICY.md defaults. Changes go
 * through a proposal workflow: propose -> approve/reject -> apply.
 */

export type AutonomyLevel =
  | "observe"
  | "pr_only"
  | "auto_merge_green"
  | "full_auto";

export interface Policy {
  key: string;
  title: string;
  bodyMd: string | null;
  autonomyLevel: AutonomyLevel;
}

export interface PolicyProposal {
  id: string;
  policyKey: string;
  proposedBy: string;
  rationale: string;
  currentValue: string | null;
  proposedValue: string;
  evidence: unknown;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
}

/** Parse POLICY.md for default policy values. */
function parsePolicyDefaults(): Map<string, Policy> {
  const defaults = new Map<string, Policy>();
  try {
    const policyPath = path.resolve(
      process.cwd(),
      "POLICY.md",
    );
    const content = readFileSync(policyPath, "utf-8");
    // Parse simple key-value sections from POLICY.md
    const sections = content.split(/^## /m).slice(1);
    for (const section of sections) {
      const lines = section.trim().split("\n");
      const title = lines[0]?.trim() ?? "";
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      if (!key) continue;
      // Look for autonomy level in the section
      const levelMatch = section.match(
        /autonomy:\s*(observe|pr_only|auto_merge_green|full_auto)/i,
      );
      defaults.set(key, {
        key,
        title,
        bodyMd: section,
        autonomyLevel: (levelMatch?.[1] as AutonomyLevel) ?? "observe",
      });
    }
  } catch {
    // POLICY.md missing is fine, DB is the primary source.
  }
  return defaults;
}

/**
 * Load current policies from DB, falling back to POLICY.md defaults for
 * keys that have no DB row yet.
 */
export async function loadPolicies(): Promise<Policy[]> {
  const db = adminDb();
  const defaults = parsePolicyDefaults();

  const rows = await db<
    {
      key: string;
      title: string;
      body_md: string | null;
      autonomy_level: string;
    }[]
  >`
    select key, title, body_md, autonomy_level
    from public.system_policies
    order by key
  `;

  const result: Policy[] = rows.map((r) => ({
    key: r.key,
    title: r.title,
    bodyMd: r.body_md,
    autonomyLevel: r.autonomy_level as AutonomyLevel,
  }));

  // Fill in defaults for keys not in DB
  const dbKeys = new Set(result.map((p) => p.key));
  for (const [key, policy] of defaults) {
    if (!dbKeys.has(key)) {
      result.push(policy);
    }
  }

  return result;
}

/**
 * Propose a policy change. Returns the proposal ID.
 */
export async function proposeChange(
  policyKey: string,
  proposedValue: string,
  rationale: string,
  evidence: unknown,
  proposedBy: "night_manager" | "signal_pattern" | "manual" = "manual",
): Promise<string> {
  const db = adminDb();

  // Get current value if it exists
  const current = await db<{ body_md: string | null }[]>`
    select body_md from public.system_policies where key = ${policyKey}
  `;

  const [row] = await db<{ id: string }[]>`
    insert into public.policy_proposals
      (policy_key, proposed_by, rationale, current_value, proposed_value, evidence)
    values (
      ${policyKey},
      ${proposedBy},
      ${rationale},
      ${current[0]?.body_md ?? null},
      ${proposedValue},
      ${JSON.stringify(evidence)}::jsonb
    )
    returning id::text
  `;

  return row!.id;
}

/**
 * Approve or reject a proposal.
 */
export async function reviewProposal(
  proposalId: string,
  status: "approved" | "rejected",
): Promise<void> {
  const db = adminDb();
  await db`
    update public.policy_proposals
    set status = ${status}, reviewed_at = now()
    where id = ${proposalId}::uuid
  `;
}

/**
 * Apply all approved proposals: update system_policies and mark
 * proposals as applied.
 */
export async function applyApprovedPolicies(): Promise<number> {
  const db = adminDb();

  const proposals = await db<
    {
      id: string;
      policy_key: string;
      proposed_value: string;
    }[]
  >`
    select id::text, policy_key, proposed_value
    from public.policy_proposals
    where status = 'approved'
    order by created_at
  `;

  let applied = 0;
  for (const p of proposals) {
    // Upsert the policy
    await db`
      insert into public.system_policies (key, title, body_md, autonomy_level, updated_at)
      values (${p.policy_key}, ${p.policy_key}, ${p.proposed_value}, 'observe', now())
      on conflict (key)
      do update set body_md = ${p.proposed_value}, updated_at = now()
    `;

    // Mark proposal as applied
    await db`
      update public.policy_proposals
      set status = 'applied', reviewed_at = now()
      where id = ${p.id}::uuid
    `;

    applied++;
  }

  return applied;
}

/**
 * Check autonomy level for a given action (policy key). Returns the
 * current autonomy level, defaulting to 'observe'.
 */
export async function checkAutonomyLevel(
  action: string,
): Promise<AutonomyLevel> {
  const db = adminDb();

  const rows = await db<{ autonomy_level: string }[]>`
    select autonomy_level
    from public.system_policies
    where key = ${action}
  `;

  return (rows[0]?.autonomy_level as AutonomyLevel) ?? "observe";
}

/**
 * Get pending proposals for review.
 */
export async function getPendingProposals(): Promise<PolicyProposal[]> {
  const db = adminDb();

  const rows = await db<
    {
      id: string;
      policy_key: string;
      proposed_by: string;
      rationale: string;
      current_value: string | null;
      proposed_value: string;
      evidence: string;
      status: string;
      reviewed_at: string | null;
      created_at: string;
    }[]
  >`
    select
      id::text,
      policy_key,
      proposed_by,
      rationale,
      current_value,
      proposed_value,
      evidence::text,
      status,
      reviewed_at::text,
      created_at::text
    from public.policy_proposals
    where status = 'pending'
    order by created_at
  `;

  return rows.map((r) => ({
    id: r.id,
    policyKey: r.policy_key,
    proposedBy: r.proposed_by,
    rationale: r.rationale,
    currentValue: r.current_value,
    proposedValue: r.proposed_value,
    evidence: r.evidence ? JSON.parse(r.evidence) : null,
    status: r.status,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }));
}
