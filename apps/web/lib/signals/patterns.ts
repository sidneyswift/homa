import { adminDb } from "../admin/db";

/**
 * Layer 4: Pattern Detection.
 * Detects recurring signal patterns across families. A pattern is a
 * signal type occurring 3+ times, grouping by evidence similarity
 * (not just type).
 */

export interface DetectedPattern {
  id: string | null;
  signalType: string;
  patternDescription: string;
  familyCount: number;
  occurrenceCount: number;
  sampleEvidence: string[];
  status: string;
}

/**
 * Detect patterns: signal types that recur across families. Inserts new
 * patterns into signal_patterns if they do not already exist.
 */
export async function detectPatterns(
  minOccurrences = 3,
): Promise<DetectedPattern[]> {
  const db = adminDb();

  // Find signal types with enough occurrences in the last 7 days
  const rows = await db<
    {
      signal_type: string;
      family_count: number;
      occurrence_count: number;
      sample_evidence: string;
    }[]
  >`
    select
      signal_type,
      count(distinct family_id)::int as family_count,
      count(*)::int as occurrence_count,
      json_agg(distinct evidence order by evidence)::text as sample_evidence
    from public.conversation_signals
    where created_at >= now() - interval '7 days'
    group by signal_type
    having count(*) >= ${minOccurrences}
    order by count(*) desc
  `;

  const patterns: DetectedPattern[] = [];

  for (const r of rows) {
    const evidence: string[] = JSON.parse(r.sample_evidence).slice(0, 5);
    const description = `${r.signal_type}: ${r.occurrence_count} occurrences across ${r.family_count} families`;

    // Check if a pattern for this signal type already exists and is active
    const existing = await db<{ id: string; status: string }[]>`
      select id::text, status
      from public.signal_patterns
      where signal_type = ${r.signal_type}
        and status in ('detected', 'skill_drafted')
      limit 1
    `;

    if (existing.length > 0) {
      // Update counts
      await db`
        update public.signal_patterns
        set family_count = ${r.family_count},
            occurrence_count = ${r.occurrence_count},
            sample_evidence = ${JSON.stringify(evidence)}::jsonb
        where id = ${existing[0]!.id}::uuid
      `;

      patterns.push({
        id: existing[0]!.id,
        signalType: r.signal_type,
        patternDescription: description,
        familyCount: r.family_count,
        occurrenceCount: r.occurrence_count,
        sampleEvidence: evidence,
        status: existing[0]!.status,
      });
    } else {
      // Insert new pattern
      const [inserted] = await db<{ id: string }[]>`
        insert into public.signal_patterns
          (signal_type, pattern_description, family_count, occurrence_count, sample_evidence)
        values (
          ${r.signal_type},
          ${description},
          ${r.family_count},
          ${r.occurrence_count},
          ${JSON.stringify(evidence)}::jsonb
        )
        returning id::text
      `;

      patterns.push({
        id: inserted!.id,
        signalType: r.signal_type,
        patternDescription: description,
        familyCount: r.family_count,
        occurrenceCount: r.occurrence_count,
        sampleEvidence: evidence,
        status: "detected",
      });
    }
  }

  return patterns;
}

/**
 * Get patterns that have not been addressed yet (status = 'detected').
 */
export async function getActivePatterns(): Promise<DetectedPattern[]> {
  const db = adminDb();

  const rows = await db<
    {
      id: string;
      signal_type: string;
      pattern_description: string;
      family_count: number;
      occurrence_count: number;
      sample_evidence: string;
      status: string;
    }[]
  >`
    select
      id::text,
      signal_type,
      pattern_description,
      family_count::int,
      occurrence_count::int,
      sample_evidence::text,
      status
    from public.signal_patterns
    where status in ('detected', 'skill_drafted')
    order by occurrence_count desc
  `;

  return rows.map((r) => ({
    id: r.id,
    signalType: r.signal_type,
    patternDescription: r.pattern_description,
    familyCount: r.family_count,
    occurrenceCount: r.occurrence_count,
    sampleEvidence: r.sample_evidence ? JSON.parse(r.sample_evidence) : [],
    status: r.status,
  }));
}
