import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_SMS_PARTS,
  MAX_SMS_SEGMENTS,
  fitsInOneSms,
  gsm7Transliterate,
  planSmsParts,
  smsSegmentCount,
  splitForSms,
} from "./sms-segments";

describe("SMS segment math", () => {
  it("counts GSM-7 text at 160 then 153 characters per segment", () => {
    assert.equal(smsSegmentCount(""), 0);
    assert.equal(smsSegmentCount("hello"), 1);
    assert.equal(smsSegmentCount("a".repeat(160)), 1);
    assert.equal(smsSegmentCount("a".repeat(161)), 2);
    assert.equal(smsSegmentCount("a".repeat(306)), 2);
    assert.equal(smsSegmentCount("a".repeat(307)), 3);
    assert.equal(smsSegmentCount("a".repeat(1530)), 10);
    assert.equal(smsSegmentCount("a".repeat(1531)), 11);
  });

  it("counts GSM-7 extension characters as two septets", () => {
    assert.equal(smsSegmentCount("{".repeat(80)), 1);
    assert.equal(smsSegmentCount("{".repeat(81)), 2);
  });

  it("switches the whole message to UCS-2 when any character is outside GSM-7", () => {
    assert.equal(smsSegmentCount("\u{1F52C}"), 1);
    assert.equal(smsSegmentCount(`\u2019${"a".repeat(69)}`), 1);
    assert.equal(smsSegmentCount(`\u2019${"a".repeat(70)}`), 2);
    assert.equal(smsSegmentCount(`\u2019${"a".repeat(669)}`), 10);
    assert.equal(smsSegmentCount(`\u2019${"a".repeat(670)}`), 11);
  });

  it("counts UCS-2 payloads in UTF-16 code units, so an emoji costs two", () => {
    // The microscope emoji is one code point but two UTF-16 units.
    const emojiLead = (asciiChars: number) =>
      `\u{1F52C}${"a".repeat(asciiChars)}`;
    assert.equal(smsSegmentCount(emojiLead(68)), 1);
    assert.equal(smsSegmentCount(emojiLead(69)), 2);
  });

  it("matches the Telnyx verdicts observed on 2026-07-13", () => {
    // The three failed morning briefs: emoji-led, 755 to 830 code
    // points (one more UTF-16 unit each). Telnyx computed 12 to 13
    // parts and rejected them with error 40302.
    const failedBrief = (codePoints: number) =>
      `\u{1F52C}${"a".repeat(codePoints - 1)}`;
    assert.equal(smsSegmentCount(failedBrief(755)), 12);
    assert.equal(smsSegmentCount(failedBrief(830)), 13);
    assert.equal(fitsInOneSms(failedBrief(755)), false);

    // The one emoji brief that DID send was 665 code points: exactly
    // 10 parts, Telnyx accepted it ("parts": 10 in the response).
    assert.equal(smsSegmentCount(failedBrief(665)), MAX_SMS_SEGMENTS);
    assert.equal(fitsInOneSms(failedBrief(665)), true);

    // The 825-character no-emoji custom task text stayed GSM-7 and
    // sent as 6 parts.
    assert.equal(smsSegmentCount("a".repeat(825)), 6);
  });
});

describe("GSM-7 transliteration", () => {
  it("replaces smart punctuation with GSM equivalents", () => {
    assert.equal(
      gsm7Transliterate("‘hi’ “there” – ok…"),
      `'hi' "there" - ok...`,
    );
  });

  it("keeps GSM accents and strips marks GSM cannot carry", () => {
    // é è ù are in the GSM basic set and survive; á í ó ú lose only
    // their accents.
    assert.equal(gsm7Transliterate("café"), "café");
    assert.equal(gsm7Transliterate("mamá oyó música"), "mama oyo musica");
  });

  it("drops emoji and their invisible joiners entirely", () => {
    assert.equal(gsm7Transliterate("\u{1F52C} lab day \u{1F389}"), "lab day");
    assert.equal(gsm7Transliterate("go\u200D\uFE0F team"), "go team");
  });

  it("turns the 2026-07-13 failing shape back into one deliverable SMS", () => {
    const failedBrief = `\u{1F52C}${"a".repeat(754)}`;
    assert.equal(fitsInOneSms(failedBrief), false);
    const rescued = gsm7Transliterate(failedBrief);
    assert.equal(rescued, "a".repeat(754));
    assert.equal(fitsInOneSms(rescued), true);
  });
});

describe("SMS splitting", () => {
  it("returns one part when the text already fits", () => {
    assert.deepEqual(splitForSms("short text"), ["short text"]);
  });

  it("splits at word boundaries with every part under the cap", () => {
    const text = Array.from(
      { length: 400 },
      (_, index) => `word${index}`,
    ).join(" ");
    const parts = splitForSms(text);
    assert.ok(parts.length >= 2);
    for (const part of parts) {
      assert.ok(fitsInOneSms(part));
      assert.equal(part, part.trim());
    }
    assert.equal(parts.join(" "), text);
  });

  it("hard-slices a single token no boundary can save", () => {
    const token = "a".repeat(1700);
    const parts = splitForSms(token);
    assert.ok(parts.length >= 2);
    for (const part of parts) assert.ok(fitsInOneSms(part));
    assert.equal(parts.join(""), token);
  });
});

describe("SMS delivery planning", () => {
  it("never rewrites a message that already fits", () => {
    const text = `\u{1F52C} short note with an emoji`;
    assert.deepEqual(planSmsParts(text), { ok: true, parts: [text] });
  });

  it("rescues the digest failure shape by transliteration alone", () => {
    // 11 segments over UCS-2, exactly the refusals in the 2026-07-16
    // and 2026-07-17 founder digests.
    const overCap = `’${"a".repeat(670)}`;
    assert.equal(smsSegmentCount(overCap), 11);
    const plan = planSmsParts(overCap);
    assert.ok(plan.ok);
    assert.deepEqual(plan.parts, [`'${"a".repeat(670)}`]);
  });

  it("splits genuinely long GSM-7 text into a few messages", () => {
    const text = Array.from(
      { length: 500 },
      (_, index) => `word${index}`,
    ).join(" ");
    assert.ok(smsSegmentCount(text) > MAX_SMS_SEGMENTS);
    const plan = planSmsParts(text);
    assert.ok(plan.ok);
    assert.ok(plan.parts.length >= 2 && plan.parts.length <= MAX_SMS_PARTS);
    for (const part of plan.parts) assert.ok(fitsInOneSms(part));
  });

  it("still refuses a pathological payload", () => {
    const plan = planSmsParts("a".repeat(60_000));
    assert.equal(plan.ok, false);
    assert.ok(!plan.ok && plan.reason.includes("carrier size limit"));
  });
});
