import type { Modality } from "../agent-memory";
import { mapDb } from "../map/db";
import { synthesizeModalityProfile } from "./synthesize-modality-profile";

/**
 * Write a negative modality signal when a skill needs reteaching.
 *
 * Called when evidence shows regression (a skill going from "easily" to
 * "getting_there" or "not_yet") and we can determine what modality
 * approach was last used for that subject. The signal tells the profile
 * synthesizer that this modality didn't work for this subject, shifting
 * preferences toward alternatives.
 *
 * Best-effort: failures are logged but never thrown.
 */
export async function writeReteachSignal(input: {
  familyId: string;
  childId: string;
  modality: Modality;
  subjectId: string | null;
  content: string;
  sourceSessionId?: string | null;
  sourceLessonId?: string | null;
}): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      INSERT INTO public.learner_modality_signals
        (family_id, child_id, modality, subject_id, signal_type, valence, content,
         source_session_id, source_lesson_id)
      VALUES
        (${input.familyId}, ${input.childId}, ${input.modality},
         ${input.subjectId ?? null}, 'reteach_signal', -1,
         ${input.content.slice(0, 300)},
         ${input.sourceSessionId ?? null}, ${input.sourceLessonId ?? null})
    `;
    await synthesizeModalityProfile(input.familyId, input.childId);
  } catch (error) {
    console.error(
      "reteach signal write failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

/**
 * Find the most recent modality used for a child+subject combination
 * by looking at finalized materials and what_works memories.
 * Returns null if no modality signal exists for this subject.
 */
export async function lastModalityUsedForSubject(
  familyId: string,
  childId: string,
  subjectId: string,
): Promise<Modality | null> {
  const sql = mapDb();
  const rows = await sql<{ modality: string }[]>`
    SELECT modality FROM public.learner_modality_signals
    WHERE family_id = ${familyId}
      AND child_id = ${childId}
      AND subject_id = ${subjectId}
      AND valence = 1
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (rows[0]?.modality as Modality) ?? null;
}
