import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateResearchBriefFormat } from "./research-brief-format";

const VALID_CTA =
  "Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?";
const LEARNED_FIRST =
  "Reading Rockets says a stretchy sound stays on into the next sound, so the word reaches the ear as one piece.";
const LEARNED =
  `${LEARNED_FIRST} In mat, mmm runs into a before the quick t closes mat.`;
const INTERESTING =
  'Story said "ship" sounds choppy in Bob Books. Story can try "sh" running into "i" before the quick "p" closes "ship".';
const TOPIC = "keeping sounds together while reading";
const VALID = `Last night I researched ${TOPIC}

What I learned: ${LEARNED}

Why it's interesting: ${INTERESTING}

${VALID_CTA}`;
const CARRIER_VALID = `Last night I researched maps

What I learned: ERIC says paths grow. A small step helps.

Why it's interesting: Story likes maps. She can trace a path.

Want me to make Story a map game for map tracing?`;

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

  it("uses the plain headline and a 900 visible-character ceiling", () => {
    assert.deepEqual(validateResearchBriefFormat(VALID), { ok: true });
    assertInvalid(
      [
        VALID.replace(
          "Reading Rockets says a stretchy sound",
          `${"Useful ".repeat(120)}Reading Rockets says a stretchy sound`,
        ),
      ],
      "visible characters",
    );
  });

  it("rejects the retired microscope headline", () => {
    assertInvalid([VALID.replace("Last night", "🔬 Last night")], "headline");
  });

  it("requires the overnight headline and rejects same-morning research", () => {
    const sameMorningBrief = VALID.replace(
      "Last night I researched",
      "This morning I researched",
    );
    const validation = validateResearchBriefFormat(sameMorningBrief);
    assert.equal(validation.ok, false);
    if (!validation.ok) {
      assert.ok(validation.errors.includes("headline tense"));
    }
  });

  it("requires the exact seven-line layout and anchored labels", () => {
    assertInvalid([
      `\n${VALID}`,
      `${VALID}\n`,
      VALID.replace(
        TOPIC,
        `${TOPIC}\nextra headline line`,
      ),
      VALID.replace("\n\nWhat I learned:", "\n\n\nWhat I learned:"),
    ], "expected exact seven-line layout");
    assertInvalid([
      VALID.replace(TOPIC, "   "),
      VALID.replace(TOPIC, "."),
    ], "headline topic");
    assertInvalid([
      VALID.replace("What I learned: ", "What I learned:"),
      VALID.replace("What I learned:", "Finding:"),
    ], "learned label");
  });

  it("requires one or two complete sentences in each content block", () => {
    assertInvalid([
      VALID.replace(
        LEARNED_FIRST,
        "One. Two. Three.",
      ),
      VALID.replace(
        LEARNED,
        "Holding one sound into the next helps a child blend smoothly",
      ),
      VALID.replace(
        LEARNED,
        ".",
      ),
    ], "learned sentence count");
    assertInvalid([
      VALID.replace(
        INTERESTING,
        "!",
      ),
    ], "interesting sentence count");

    const abbreviationBrief = VALID.replace(
      LEARNED,
      "U.S. reading research supports smooth sound blending. Holding mmm into a makes the practical change audible.",
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

  it("rejects links, saved-note claims, markdown, emoji, and internal terms", () => {
    assertInvalid([
      VALID.replace("stretchy sound", "*stretchy sound*"),
      VALID.replace("stretchy sound", "~~stretchy sound~~"),
      VALID.replace(
        "stretchy sound",
        "[stretchy sound](source)",
      ),
    ], "markdown");
    assertInvalid([
      VALID.replace(
        TOPIC,
        `${TOPIC} 🇺🇸`,
      ),
      VALID.replace(
        TOPIC,
        `${TOPIC} \u{1F1FA}`,
      ),
    ], "emoji");
    assertInvalid([
      VALID.replace(
        TOPIC,
        `${TOPIC} subjectId`,
      ),
      VALID.replace(TOPIC, "keeping sounds CVC"),
      VALID.replace(TOPIC, "keeping sounds C-V-C"),
      VALID.replace(TOPIC, "keeping sounds C.V.C."),
      VALID.replace(
        TOPIC,
        `${TOPIC} at_age`,
      ),
    ], "internal vocabulary");
    assertInvalid([
      VALID.replace(
        "What I learned:",
        "What I learned: Saved it to Homa.",
      ),
      VALID.replace(
        LEARNED_FIRST,
        "I saved this note in Homa.",
      ),
    ], "saved link");
    assertInvalid([
      VALID.replace(
        TOPIC,
        `${TOPIC} example.com`,
      ),
      VALID.replace(
        TOPIC,
        `${TOPIC} example.xyz`,
      ),
    ], "saved link");
    assertInvalid([
      VALID.replace("reaches the ear", "reaches the ear\u2014quickly"),
    ], "em dash");
  });

  it("accepts a GSM-7 brief that uses all ten carrier segments", () => {
    const nearCapBrief = CARRIER_VALID.replace(
      "paths grow",
      `paths${"^".repeat(650)} grow`,
    );
    assert.ok(nearCapBrief.length > 765);
    assert.ok(nearCapBrief.length <= 900);
    assert.deepEqual(validateResearchBriefFormat(nearCapBrief), { ok: true });
  });

  it("rejects a GSM-7 brief requiring eleven carrier segments", () => {
    const elevenSegmentBrief = CARRIER_VALID.replace(
      "paths grow",
      `paths${"^".repeat(699)} grow`,
    );
    assert.ok(elevenSegmentBrief.length <= 900);
    assertInvalid([elevenSegmentBrief], "SMS segments");
  });
});
