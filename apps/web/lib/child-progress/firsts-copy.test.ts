import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BANNED_WORDS, EM_DASH } from "@homa/core";

import {
  FIRSTS_CONTESTED_LINE,
  FIRSTS_DOOR,
  FIRSTS_JUMP_RECENT,
  FIRSTS_PROVENANCE_SUMMARY,
  FIRSTS_TITLE,
  firstsEmptyBody,
  firstsEmptyHeading,
  firstsHeading,
  firstsIntro,
  firstsMatchedAbility,
  firstsMeta,
  firstsNoQuote,
  firstsQuoteLabel,
  firstsSourceNoun,
  firstsSubjectMarker,
  firstsSubjectMarkerBody,
  provenanceChannelLine,
} from "./firsts-copy";
import type { ProgressCheckInChannel, ProgressSourceKind } from "./types";

const ALL_SOURCES: ProgressSourceKind[] = [
  "journal",
  "conversation",
  "check_in",
  "checklist",
  "deep_dive",
  "correction",
  "report_correction",
  "report_probe",
  "recheck",
  "onboarding_walk",
  "legacy",
  "lesson_listen",
];

const ALL_CHANNELS: (ProgressCheckInChannel | null)[] = [
  "web",
  "sms",
  "email",
  "dispatch",
  "voice",
  "lesson",
  null,
];

function everyString(): string[] {
  return [
    FIRSTS_TITLE,
    FIRSTS_CONTESTED_LINE,
    FIRSTS_DOOR,
    FIRSTS_JUMP_RECENT,
    FIRSTS_PROVENANCE_SUMMARY,
    firstsHeading("Story"),
    firstsIntro("Story"),
    firstsEmptyHeading("Story"),
    firstsEmptyBody("Story"),
    firstsSubjectMarker("Math"),
    firstsMatchedAbility("Counts to five"),
    firstsQuoteLabel("Alessa"),
    firstsQuoteLabel(null),
    firstsMeta("Alessa", "journal", "March 3, 2026"),
    firstsMeta(null, "report_correction", "March 3, 2026"),
    ...ALL_SOURCES.map(firstsSourceNoun),
    ...ALL_SOURCES.map(firstsSubjectMarkerBody),
    ...ALL_SOURCES.map(firstsNoQuote),
    ...ALL_CHANNELS.map(provenanceChannelLine).filter(
      (line): line is string => line !== null,
    ),
  ];
}

describe("firsts-copy voice laws", () => {
  it("contains no em dash anywhere", () => {
    for (const value of everyString()) {
      assert.ok(!EM_DASH.test(value), `em dash in: ${value}`);
    }
  });

  it("contains no banned word anywhere", () => {
    for (const value of everyString()) {
      assert.ok(!BANNED_WORDS.test(value), `banned word in: ${value}`);
    }
  });

  it("never says 'finally' or 'at last'", () => {
    for (const value of everyString()) {
      assert.ok(!/finally|at last/i.test(value), `precedence word in: ${value}`);
    }
  });

  it("carries no percentage, count, or forward-looking scoreboard word", () => {
    for (const value of everyString()) {
      assert.ok(!/%/.test(value), `percentage in: ${value}`);
      assert.ok(
        !/\bout of\b|\bremaining\b|\btotal\b|\bso far\b/i.test(value),
        `scoreboard word in: ${value}`,
      );
    }
  });

  it("names no sibling relationship or second child", () => {
    for (const value of everyString()) {
      assert.ok(
        !/\bsibling\b|\bbrother\b|\bsister\b|\bthan\b/i.test(value),
        `comparison word in: ${value}`,
      );
    }
  });
});

describe("firsts-copy permanence", () => {
  it("promises no permanence, because two paths remove a line", () => {
    for (const value of everyString()) {
      assert.ok(
        !/never goes away|nothing ever leaves|always stays|forever/i.test(value),
        `permanence promise in: ${value}`,
      );
    }
  });

  it("states the removal condition in the intro", () => {
    assert.match(firstsIntro("Story"), /takes an answer back/);
  });
});

describe("firstsSourceNoun", () => {
  it("returns a non-empty adult-neutral noun for every source", () => {
    for (const source of ALL_SOURCES) {
      const noun = firstsSourceNoun(source);
      assert.ok(noun.trim().length > 0, `empty noun for ${source}`);
      assert.ok(
        !/\byou\b|\byour\b/i.test(noun),
        `source noun for ${source} names the reader: ${noun}`,
      );
    }
  });
});

describe("provenanceChannelLine", () => {
  it("is exhaustive and returns null only for null", () => {
    for (const channel of ALL_CHANNELS) {
      const line = provenanceChannelLine(channel);
      if (channel === null) {
        assert.equal(line, null);
      } else {
        assert.ok(line !== null && line.trim().length > 0);
      }
    }
  });
});

describe("firstsMeta and firstsQuoteLabel", () => {
  it("drops the adult segment and never renders 'Adult 1'", () => {
    const line = firstsMeta(null, "journal", "March 3, 2026");
    assert.ok(!/Adult\s*\d/i.test(line));
    assert.equal(line, "a note · March 3, 2026");
  });

  it("uses the firsts source noun, never a progressSourceLabel string", () => {
    const line = firstsMeta("Alessa", "report_correction", "March 3, 2026");
    assert.match(line, /a correction on the report/);
    assert.ok(!/Report correction/.test(line));
  });

  it("never says 'your own words' when the adult is unknown", () => {
    assert.ok(!/your own words/i.test(firstsQuoteLabel(null)));
    assert.match(firstsQuoteLabel("Alessa"), /Alessa's own words/);
  });
});

describe("firstsEmptyBody", () => {
  it("never asserts the parent has said nothing and renders no zero", () => {
    const body = firstsEmptyBody("Story");
    assert.ok(!/\b0\b|nothing|haven't|have not/i.test(body));
  });
});
