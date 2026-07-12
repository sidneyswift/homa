import { adminDb } from "./db";

/**
 * Night Manager context builder: aggregates self-improving system data
 * for the Night Manager's nightly analysis. All reads use adminDb()
 * with sequential queries.
 */

export interface NightContext {
  signalSummary: { signalType: string; count: number }[];
  activePatterns: {
    id: string;
    signalType: string;
    description: string;
    familyCount: number;
    occurrenceCount: number;
  }[];
  knowledgeGaps: {
    topic: string;
    queryText: string;
    priority: number;
    source: string;
  }[];
  fixEffectiveness: {
    signalType: string;
    totalFixes: number;
    resolvedCount: number;
    avgEffectiveness: number | null;
  }[];
  pendingProposals: {
    id: string;
    policyKey: string;
    rationale: string;
    proposedBy: string;
  }[];
  skillEvolution: {
    skillName: string;
    changeType: string;
    status: string;
    patternDescription: string;
  }[];
}

/**
 * Build the full night context for the Night Manager. Each query runs
 * sequentially (adminDb contract: max 1 connection, no Promise.all).
 */
export async function buildNightContext(): Promise<NightContext> {
  const db = adminDb();

  // 1. Signal summary (last 24h by type)
  const signalSummary = await db<
    { signal_type: string; cnt: number }[]
  >`
    select signal_type, count(*)::int as cnt
    from public.conversation_signals
    where created_at >= now() - interval '24 hours'
    group by signal_type
    order by count(*) desc
  `;

  // 2. Active patterns (signals occurring 3+ times)
  const activePatterns = await db<
    {
      id: string;
      signal_type: string;
      pattern_description: string;
      family_count: number;
      occurrence_count: number;
    }[]
  >`
    select
      id::text,
      signal_type,
      pattern_description,
      family_count::int,
      occurrence_count::int
    from public.signal_patterns
    where status in ('detected', 'skill_drafted')
    order by occurrence_count desc
    limit 20
  `;

  // 3. Knowledge gaps (open, needing research)
  const knowledgeGaps = await db<
    {
      topic: string;
      query_text: string;
      research_priority: number;
      source: string;
    }[]
  >`
    select topic, query_text, research_priority::int, source
    from public.knowledge_gaps
    where status = 'open'
    order by research_priority desc
    limit 20
  `;

  // 4. Fix effectiveness
  const fixEffectiveness = await db<
    {
      signal_type: string;
      total_fixes: number;
      resolved_count: number;
      avg_effectiveness: number | null;
    }[]
  >`
    select
      fe.signal_type,
      count(*)::int as total_fixes,
      count(*) filter (where er.resolved = true)::int as resolved_count,
      avg(fe.effectiveness_score) as avg_effectiveness
    from public.fix_effectiveness fe
    join public.eval_results er on er.id = fe.fix_id
    group by fe.signal_type
    order by count(*) desc
  `;

  // 5. Pending policy proposals
  const pendingProposals = await db<
    {
      id: string;
      policy_key: string;
      rationale: string;
      proposed_by: string;
    }[]
  >`
    select id::text, policy_key, rationale, proposed_by
    from public.policy_proposals
    where status = 'pending'
    order by created_at
  `;

  // 6. Skill evolution status
  const skillEvolution = await db<
    {
      skill_name: string;
      change_type: string;
      status: string;
      pattern_description: string;
    }[]
  >`
    select
      sel.skill_name,
      sel.change_type,
      sel.status,
      sp.pattern_description
    from public.skill_evolution_log sel
    join public.signal_patterns sp on sp.id = sel.pattern_id
    where sel.status in ('drafted', 'proposed')
    order by sel.created_at desc
    limit 10
  `;

  return {
    signalSummary: signalSummary.map((r) => ({
      signalType: r.signal_type,
      count: r.cnt,
    })),
    activePatterns: activePatterns.map((r) => ({
      id: r.id,
      signalType: r.signal_type,
      description: r.pattern_description,
      familyCount: r.family_count,
      occurrenceCount: r.occurrence_count,
    })),
    knowledgeGaps: knowledgeGaps.map((r) => ({
      topic: r.topic,
      queryText: r.query_text,
      priority: r.research_priority,
      source: r.source,
    })),
    fixEffectiveness: fixEffectiveness.map((r) => ({
      signalType: r.signal_type,
      totalFixes: r.total_fixes,
      resolvedCount: r.resolved_count,
      avgEffectiveness: r.avg_effectiveness,
    })),
    pendingProposals: pendingProposals.map((r) => ({
      id: r.id,
      policyKey: r.policy_key,
      rationale: r.rationale,
      proposedBy: r.proposed_by,
    })),
    skillEvolution: skillEvolution.map((r) => ({
      skillName: r.skill_name,
      changeType: r.change_type,
      status: r.status,
      patternDescription: r.pattern_description,
    })),
  };
}
