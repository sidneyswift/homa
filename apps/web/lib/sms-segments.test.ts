import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_SMS_SEGMENTS,
  fitsInOneSms,
  smsSegmentCount,
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
