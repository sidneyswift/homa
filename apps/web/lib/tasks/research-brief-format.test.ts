import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateResearchBriefFormat } from "./research-brief-format";

const VALID_CTA =
  "Want me to make Story a connected-phonation word strip for smoother blending?";
const VALID = `🔬 Last night I researched phonics

What I learned: Connected phonation helps early readers hold sounds together while blending. Adding each sound as the word grows works especially well for stop sounds.

Why it's interesting: Story is already reading Bob Books and is ready to make blending smoother. This changes how you model the same words, not what Story needs to learn next.

${VALID_CTA}`;

function withCta(cta: string): string {
  return VALID.replace(VALID_CTA, cta);
}

function assertInvalid(values: string[], expectedError: string): void {
  for (const value of values) {
    const validation = validateResearchBriefFormat(value);
    assert.equal(validation.ok, false);
    if (!validation.ok) {
      assert.ok(
        validation.errors.includes(expectedError),
        `expected "${expectedError}" in ${JSON.stringify(validation.errors)}`,
      );
    }
  }
}

describe("morning research brief format", () => {
  it("accepts the approved four-block shape", () => {
    assert.deepEqual(validateResearchBriefFormat(VALID), { ok: true });
  });

  it("accepts the honest top-up headline and enforces expected tense", () => {
    const topUpBrief = VALID.replace(
      "Last night I researched",
      "This morning I researched",
    );
    assert.deepEqual(
      validateResearchBriefFormat(topUpBrief, { expectedTense: "top-up" }),
      { ok: true },
    );
    const mismatchedTense = validateResearchBriefFormat(topUpBrief, {
      expectedTense: "overnight",
    });
    assert.equal(mismatchedTense.ok, false);
    if (!mismatchedTense.ok) {
      assert.ok(mismatchedTense.errors.includes("headline tense"));
    }
  });

  it("requires the exact seven-line layout and anchored labels", () => {
    assertInvalid([
      `\n${VALID}`,
      `${VALID}\n`,
      VALID.replace("phonics", "phonics\nextra headline line"),
      VALID.replace("\n\nWhat I learned:", "\n\n\nWhat I learned:"),
    ], "expected exact seven-line layout");
    assertInvalid([
      VALID.replace("phonics", "   "),
      VALID.replace("phonics", "."),
    ], "headline topic");
    assertInvalid([
      VALID.replace("What I learned: ", "What I learned:"),
      VALID.replace("What I learned:", "Finding:"),
    ], "learned label");
  });

  it("requires one or two complete sentences in each content block", () => {
    assertInvalid([
      VALID.replace(
        "Connected phonation helps early readers hold sounds together while blending.",
        "One. Two. Three.",
      ),
      VALID.replace(
        "Connected phonation helps early readers hold sounds together while blending. Adding each sound as the word grows works especially well for stop sounds.",
        "Connected phonation helps early readers hold sounds together while blending",
      ),
      VALID.replace(
        "Connected phonation helps early readers hold sounds together while blending. Adding each sound as the word grows works especially well for stop sounds.",
        ".",
      ),
    ], "learned sentence count");
    assertInvalid([
      VALID.replace(
        "Story is already reading Bob Books and is ready to make blending smoother. This changes how you model the same words, not what Story needs to learn next.",
        "!",
      ),
    ], "interesting sentence count");

    const abbreviationBrief = VALID.replace(
      "Connected phonation helps early readers hold sounds together while blending. Adding each sound as the word grows works especially well for stop sounds.",
      "U.S. reading research supports connected phonation. The method keeps sounds together while a child blends.",
    );
    assert.deepEqual(validateResearchBriefFormat(abbreviationBrief), {
      ok: true,
    });
  });

  it("requires one supported and specific CTA", () => {
    assertInvalid([withCta("Want me to  ?")], "CTA");
    assertInvalid(
      [
        withCta("Want me to buy Story a tablet?"),
        withCta("Want me to make Story a game and a printable?"),
        withCta("Want me to make Story a game and buy a tablet?"),
        withCta("Want me to make Story a blending game, then buy a tablet?"),
        withCta("Want me to create a shopping list for the game?"),
        withCta("Want me to make a game?"),
        withCta("Want me to make Story play a blending game?"),
        withCta(
          "Want me to make Story a blending game and teach her the sounds?",
        ),
        withCta("Want me to make Story a blending game and rent a tablet?"),
        withCta("Want me to make game ! ! !?"),
        withCta("Want me to tell you more?"),
        withCta("Want me to make Story a quick game?"),
        withCta("Want me to set a reminder at nine?"),
        withCta(
          "Want me to make Story a blending game for phonics with a printable worksheet?",
        ),
        withCta(
          "Want me to make Story a blending game for phonics. Buy a tablet?",
        ),
        withCta(
          "Want me to make Story a blending game and a worksheet for smooth practice?",
        ),
        withCta(
          "Want me to make Story a worksheet for fractions for tomorrow's lesson?",
        ),
        withCta(
          "Want me to set a reminder for blending practice for tomorrow morning?",
        ),
        withCta("Want me to set a reminder for after breakfast?"),
      ],
      "unsupported CTA",
    );
    assertInvalid(
      [
        withCta("Want me to create an event on your calendar?"),
        withCta("Want me to add the lesson to your calander?"),
        withCta("Want me to set a reminder in your calandar?"),
        withCta("Want me to set a reminder in iCal?"),
        withCta("Want me to set a reminder in GCal tomorrow?"),
      ],
      "calendar promise",
    );
    assertInvalid(
      [withCta("Want me to make a word strip? Or a worksheet?")],
      "one CTA",
    );
  });

  it("accepts each supported CTA category", () => {
    const supportedCtas = [
      "Want me to design Story a quick activity for smooth blending?",
      "Want me to make Story a book activity for smooth blending?",
      "Want me to make Story a printable worksheet for smooth blending?",
      "Want me to set a reminder for blending practice tomorrow at nine?",
      "Want me to create a task for blending practice tomorrow?",
    ];
    for (const cta of supportedCtas) {
      assert.deepEqual(
        validateResearchBriefFormat(withCta(cta)),
        { ok: true },
      );
    }
  });

  it("rejects links, saved-note claims, markdown, extra emoji, and internal terms", () => {
    assertInvalid([
      VALID.replace("Connected phonation", "*Connected phonation*"),
      VALID.replace("Connected phonation", "~~Connected phonation~~"),
      VALID.replace(
        "Connected phonation",
        "[Connected phonation](source)",
      ),
    ], "markdown");
    assertInvalid([
      VALID.replace("phonics", "phonics 🇺🇸"),
      VALID.replace("phonics", "phonics \u{1F1FA}"),
    ], "emoji count");
    assertInvalid([
      VALID.replace("phonics", "phonics subjectId"),
      VALID.replace("phonics", "phonics CVC"),
      VALID.replace("phonics", "phonics C-V-C"),
      VALID.replace("phonics", "phonics C.V.C."),
      VALID.replace("phonics", "phonics at_age"),
    ], "internal vocabulary");
    assertInvalid([
      VALID.replace(
        "What I learned:",
        "What I learned: Saved it to Homa.",
      ),
      VALID.replace(
        "Connected phonation helps early readers hold sounds together while blending.",
        "I saved this note in Homa.",
      ),
    ], "saved link");
    assertInvalid([
      VALID.replace("phonics", "phonics example.com"),
      VALID.replace("phonics", "phonics example.xyz"),
    ], "saved link");
    assertInvalid([
      VALID.replace("helps early readers", "helps early readers\u2014quickly"),
    ], "em dash");
  });

  it("rejects messages over the delivery ceiling", () => {
    assertInvalid([
      VALID.replace(
        "Connected phonation helps",
        `${"Very ".repeat(400)}Connected phonation helps`,
      ),
    ], "length");
  });

  it("rejects briefs the emoji pushes past the carrier segment cap", () => {
    // The 2026-07-13 incident shape: a well-formed brief in the 700 to
    // 830 character range. The required emoji makes carriers count 67
    // characters per segment, so anything past 670 cannot leave as one
    // SMS (Telnyx error 40302).
    const incidentLengthBrief = VALID.replace(
      "Connected phonation helps",
      `${"Very ".repeat(80)}Connected phonation helps`,
    );
    assert.ok(incidentLengthBrief.length > 670);
    assert.ok(incidentLengthBrief.length < 900);
    assertInvalid([incidentLengthBrief], "length");
  });

  it("accepts a brief that fills the whole deliverable budget", () => {
    const nearCapBrief = VALID.replace(
      "Connected phonation helps",
      `${"Very ".repeat(40)}Connected phonation helps`,
    );
    assert.ok(nearCapBrief.length > 550);
    assert.ok(nearCapBrief.length <= 669);
    assert.deepEqual(validateResearchBriefFormat(nearCapBrief), { ok: true });
  });
});
