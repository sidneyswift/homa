import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { keptAudioNote, lessonAudioKeep } from "./keep-audio";
import type { LessonMoment } from "./synthesis";

/**
 * Two things are being guarded, and only one of them is the rule.
 *
 * The rule is small: keep the recording when the review found a
 * breakthrough or a sweet moment. The part worth testing hardest is the
 * DISCLOSURE, because Homa keeps this without being asked. A retention
 * the parent is never told about is not what the ruling authorized, and
 * a note that claims whose voice is on the recording would assert
 * something no code here can check.
 */

function moment(
  kind: LessonMoment["kind"],
  segmentSeq = 1,
  headline = "Counted to twenty without stopping",
): LessonMoment {
  return { kind, segmentSeq, headline, detail: "Detail." };
}

describe("lessonAudioKeep", () => {
  it("keeps a breakthrough and a sweet moment", () => {
    assert.equal(lessonAudioKeep([moment("breakthrough")], 2)?.kind, "breakthrough");
    assert.equal(lessonAudioKeep([moment("sweet")], 2)?.kind, "sweet");
  });

  it("keeps nothing for an ordinary good lesson", () => {
    // A rule that fires on excited or engaged keeps essentially every
    // lesson, which is a retention change wearing a feature.
    assert.equal(lessonAudioKeep([moment("excited"), moment("engaged")], 2), null);
    assert.equal(lessonAudioKeep([], 2), null);
  });

  it("never keeps on a hard moment", () => {
    assert.equal(lessonAudioKeep([moment("frustrated"), moment("distracted")], 2), null);
  });

  it("ignores a moment pointing at a segment that does not exist", () => {
    // The moment's segment is the one claim this rule reads, so it gets
    // the same provenance check the clause gate applies to quotes.
    assert.equal(lessonAudioKeep([moment("breakthrough", 9)], 2), null);
    assert.equal(lessonAudioKeep([moment("breakthrough", 0)], 2), null);
    assert.equal(lessonAudioKeep([moment("sweet", 1)], 0), null);
  });

  it("takes the first keepworthy moment when several qualify", () => {
    const keep = lessonAudioKeep(
      [moment("distracted", 1), moment("sweet", 2, "Hugged her brother"), moment("breakthrough", 3)],
      3,
    );
    assert.equal(keep?.kind, "sweet");
    assert.equal(keep?.segmentSeq, 2);
  });
});

describe("keptAudioNote", () => {
  it("tells her plainly that Homa kept it, and how to undo it", () => {
    const note = keptAudioNote("Story", "Tuesday");
    assert.match(note.heading, /kept/i);
    assert.match(note.body, /Tuesday/);
    assert.match(note.action, /[Dd]elete/);
  });

  it("never claims whose voice is on the recording", () => {
    // The whole reason the ruling was narrowed: there is no diarization
    // and no word timings, so any sentence about "Story's voice" or a
    // clip length would assert something nothing can verify.
    const note = keptAudioNote("Story", "Tuesday");
    const all = `${note.heading} ${note.body} ${note.action}`;
    assert.ok(!/\bvoice\b/i.test(all), "no claim about whose voice it is");
    assert.ok(!/\bclip\b/i.test(all), "no clip claim: nothing is trimmed");
    assert.ok(!/second|minute/i.test(all), "no duration claim");
    assert.ok(!/Story said|said\b/i.test(all), "no speaker attribution");
  });

  it("obeys the voice laws", () => {
    const note = keptAudioNote("Story", "Tuesday");
    const all = `${note.heading} ${note.body} ${note.action}`;
    assert.ok(!all.includes("—"), "no em dash");
    assert.ok(!/\bbehind\b/i.test(all));
    // Offers, never commands: she is told what happened, not instructed.
    assert.ok(!/you must|you should|make sure/i.test(all));
  });

  it("asks nothing of her when she does nothing", () => {
    // No countdown, no expiry warning, no second ask. Keeping it is
    // already the default; the note exists so it is not a secret.
    const note = keptAudioNote("Story", "Tuesday");
    const all = `${note.heading} ${note.body} ${note.action}`;
    assert.ok(!/expires|expiring|before it|running out|last chance/i.test(all));
  });
});
