import type { Modality } from "../agent-memory";
import { mapDb } from "../map/db";

/**
 * Learner modality profile synthesis (Phase 3 of the modality system).
 *
 * Reads raw signals from learner_modality_signals, applies time-weighted
 * aggregation with exponential decay, and writes the result back to
 * children.profile.modality_profile (JSONB). Called after every new
 * signal write so the context stays current.
 *
 * Design principle: tendencies, not labels.
 *   - Per-subject preferences that evolve over time
 *   - Minimum 3 signals before a modality influences recommendations
 *   - Confidence decays with a 60-day half-life
 *   - Always offer alternatives, never lock into one modality
 */

const DECAY_HALF_LIFE_DAYS = 60;
const MIN_SIGNALS_TO_SURFACE = 3;

interface ModalityWeight {
  weight: number;
  signal_count: number;
  last_signal: string;
}

interface ModalityProfile {
  global: Partial<Record<Modality, ModalityWeight>>;
  by_subject: Record<string, Partial<Record<Modality, ModalityWeight>>>;
  updated_at: string;
}

interface SignalRow {
  modality: string;
  subject_id: string | null;
  valence: number;
  created_at: string;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function decayWeight(ageDays: number): number {
  return Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
}

function aggregateSignals(
  signals: SignalRow[],
  now: Date,
): Partial<Record<Modality, ModalityWeight>> {
  const buckets = new Map<
    string,
    { totalWeight: number; count: number; lastSignal: Date }
  >();

  for (const signal of signals) {
    const age = daysBetween(new Date(signal.created_at), now);
    const weight = decayWeight(age) * signal.valence;
    const existing = buckets.get(signal.modality);
    const signalDate = new Date(signal.created_at);

    if (existing) {
      existing.totalWeight += weight;
      existing.count += 1;
      if (signalDate > existing.lastSignal) {
        existing.lastSignal = signalDate;
      }
    } else {
      buckets.set(signal.modality, {
        totalWeight: weight,
        count: 1,
        lastSignal: signalDate,
      });
    }
  }

  // Normalize weights to 0-1 range.
  const maxWeight = Math.max(
    ...Array.from(buckets.values()).map((b) => Math.abs(b.totalWeight)),
    1, // avoid division by zero
  );

  const result: Partial<Record<Modality, ModalityWeight>> = {};
  for (const [modality, bucket] of buckets) {
    result[modality as Modality] = {
      weight: Math.max(0, Math.min(1, bucket.totalWeight / maxWeight)),
      signal_count: bucket.count,
      last_signal: bucket.lastSignal.toISOString().slice(0, 10),
    };
  }
  return result;
}

/**
 * Re-synthesize the modality profile for a child from all their signals.
 * Writes the result to children.profile.modality_profile.
 */
export async function synthesizeModalityProfile(
  familyId: string,
  childId: string,
): Promise<ModalityProfile> {
  const sql = mapDb();
  const now = new Date();

  const signals = await sql<SignalRow[]>`
    SELECT modality, subject_id, valence, created_at
    FROM public.learner_modality_signals
    WHERE child_id = ${childId} AND family_id = ${familyId}
    ORDER BY created_at DESC
  `;

  // Split into global (no subject) and per-subject.
  const globalSignals = signals.filter((s) => s.subject_id === null);
  // All signals contribute to global; per-subject signals also contribute.
  const allForGlobal = signals;
  const subjectGroups = new Map<string, SignalRow[]>();
  for (const signal of signals) {
    if (signal.subject_id) {
      const existing = subjectGroups.get(signal.subject_id) ?? [];
      existing.push(signal);
      subjectGroups.set(signal.subject_id, existing);
    }
  }

  const profile: ModalityProfile = {
    global: aggregateSignals(allForGlobal, now),
    by_subject: {},
    updated_at: now.toISOString(),
  };

  for (const [subject, subjectSignals] of subjectGroups) {
    profile.by_subject[subject] = aggregateSignals(subjectSignals, now);
  }

  // Write to children.profile JSONB (merge, don't overwrite).
  await sql`
    UPDATE public.children
    SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object('modality_profile', ${JSON.stringify(profile)}::jsonb)
    WHERE id = ${childId} AND family_id = ${familyId}
  `;

  return profile;
}
