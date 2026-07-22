import type { LessonMoment } from "./synthesis";

/**
 * Whether a lesson's recording outlives the 30-day audio TTL
 * (founder ruling `keep-their-voice`, 2026-07-22, as narrowed the same
 * day once the verification boundary was measured).
 *
 * The ruling was "if there's a good clip, let's save it for them; they
 * don't need to opt in." What it originally asked for was a trimmed
 * twenty seconds of the CHILD's own voice, and that turned out to be
 * unbuildable rather than merely unbuilt: `transcribeAudio` reads only
 * `payload.text` (lib/voice/transcribe.ts), so there are no word
 * timings to cut on and no diarization to attribute an utterance to a
 * speaker, and `tone.ts` documents its own `speakers` field as "rough
 * audible sense only; never an identity claim". Building the clip
 * anyway would have meant a consent screen asserting something no code
 * could check.
 *
 * So Homa keeps the WHOLE lesson and claims nothing about whose voice
 * is in it. The parent still gets the real thing; the product just does
 * not overstate what it knows. If word timings ever land, the trim is
 * an addition here, not a rewrite.
 *
 * The split follows the models-judge-code-verifies law. The model
 * already made the only judgment involved when it labelled a moment
 * `breakthrough` or `sweet` during synthesis. This module makes no
 * judgment at all: it reads a typed enum the schema already validated
 * and applies a rule. No prose is inspected, no keywords are matched.
 */

/** The two kinds worth keeping a recording for. Deliberately not
 *  `excited` or `engaged`: those are good lessons, not rare ones, and a
 *  rule that keeps everything is a retention change wearing a feature. */
const KEEPWORTHY_KINDS = new Set(["breakthrough", "sweet"]);

/**
 * A lesson whose recording is kept, and the moment that earned it.
 * `null` means the TTL applies as normal, which stays the default.
 */
export interface LessonAudioKeep {
  kind: "breakthrough" | "sweet";
  segmentSeq: number;
  headline: string;
}

/**
 * lessonAudioKeep(moments, segmentCount): the keep decision.
 *
 * `segmentCount` is the verification half: a moment names the segment
 * it happened in, and a moment pointing at a segment that does not
 * exist is not evidence of anything. That is the same provenance check
 * the clause gate runs, applied to the one field this rule reads.
 */
export function lessonAudioKeep(
  moments: readonly LessonMoment[],
  segmentCount: number,
): LessonAudioKeep | null {
  for (const moment of moments) {
    if (!KEEPWORTHY_KINDS.has(moment.kind)) continue;
    if (moment.segmentSeq < 1 || moment.segmentSeq > segmentCount) continue;
    return {
      kind: moment.kind as LessonAudioKeep["kind"],
      segmentSeq: moment.segmentSeq,
      headline: moment.headline,
    };
  }
  return null;
}

/**
 * keptAudioNote(childName, day): what the parent reads on the review.
 *
 * Homa kept this without being asked, so the note is not optional and
 * not a footnote: an automatic retention the parent is never told about
 * is not what the ruling authorized. It says what happened, in one
 * sentence, and puts the undo right next to it.
 *
 * What it must never say is anything about whose voice is on the
 * recording, how long the good part is, or where inside the lesson it
 * sits. There are no word timings and no diarization, so all three
 * would be assertions nothing can check. A test holds this.
 */
export function keptAudioNote(
  childName: string,
  day: string,
): { heading: string; body: string; action: string } {
  return {
    heading: "Homa kept this recording",
    body: `There was a good moment in ${childName}'s lesson from ${day}, so the recording stays instead of clearing out after 30 days. It is yours, and nobody else can hear it.`,
    action: "Delete the recording",
  };
}
