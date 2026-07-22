import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DetailCard,
  FIELDS,
  NAME_TOKEN,
  withChildName,
  spokenDate,
  type DetailCardKind,
} from "./detail-card";

const KINDS: DetailCardKind[] = ["family_basics", "child"];

function renderCard(kind: DetailCardKind): string {
  return renderToStaticMarkup(
    <DetailCard
      card={{ kind, intro: null }}
      active
      onSaved={() => {}}
    />,
  );
}

function countInputs(html: string): number {
  return (html.match(/<(input|select|textarea)\b/gu) ?? []).length;
}

/** Static markup escapes the apostrophe in "your child's", so a copy
 *  string has to be escaped the same way before it can be looked for. */
function asRendered(text: string): string {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#x27;");
}

describe("one input per question", () => {
  // The founder rule, 2026-07-22. Two fields on screen at once is a form,
  // and a form is the thing this rebuild exists to stop being. Asserted on
  // the rendered markup rather than on FIELDS, because the rule is about
  // what she sees, not about how the catalog is shaped.
  for (const kind of KINDS) {
    it(`renders exactly one input for ${kind}`, () => {
      assert.equal(countInputs(renderCard(kind)), 1);
    });
  }

  for (const kind of KINDS) {
    it(`asks ${kind} something on every step`, () => {
      // A step with no label is a blank box with a Next button under it.
      for (const field of FIELDS[kind]) {
        assert.ok(field.label.length > 0, `${field.key} has no question`);
        assert.ok(
          field.label.endsWith("?"),
          `${field.key} label "${field.label}" is not a question`,
        );
      }
    });
  }

  it("starts every card on its first question", () => {
    // Step state must not survive from one card to the next. It did once,
    // in a way that skipped a child's name and went straight to the
    // birthday, because the docked card holds a stable tree position.
    const html = renderCard("child");
    assert.ok(
      html.includes(asRendered(FIELDS.child[0].label)),
      "did not open on step one",
    );
    assert.ok(
      !html.includes(asRendered(withChildName(FIELDS.child[1].label, {}))),
      "showed a later step too",
    );
  });

  it("labels the button Next until the last question", () => {
    assert.ok(renderCard("child").includes("Next"));
  });
});

describe("every question says who it is about", () => {
  // The founder walked onboarding and asked, of the first child question,
  // "whos name?". She had just given her OWN name and state, so the only
  // person named in the conversation was her. The card's one antecedent,
  // the "About your child" eyebrow, is hidden whenever the card is docked,
  // and every live card is docked. So the question carried nothing.
  it("names the subject on the first child question", () => {
    const html = renderCard("child");
    assert.ok(
      /your child/iu.test(html),
      "the first child question does not say whose name it wants",
    );
  });

  it("never opens a child question on a bare pronoun", () => {
    // "What is their name?" and "When were they born?" both failed this.
    for (const field of FIELDS.child) {
      assert.ok(
        !/^(what|when|where|who|how)\s+(is|are|was|were)\s+(their|they|them)\b/iu.test(
          field.label,
        ),
        `"${field.label}" leads with an unbound pronoun`,
      );
    }
  });

  it("never leaks the raw token to the screen", () => {
    // The token is the price of keeping FIELDS as plain greppable copy.
    // This is what makes that price safe: a typo in {name} shows up here
    // rather than on a parent's screen.
    for (const kind of KINDS) {
      assert.ok(
        !renderCard(kind).includes(NAME_TOKEN),
        `${kind} rendered a literal ${NAME_TOKEN}`,
      );
    }
  });

  it("substitutes the name she typed", () => {
    assert.equal(
      withChildName(`When was ${NAME_TOKEN} born?`, { childName: "Ivy" }),
      "When was Ivy born?",
    );
    assert.equal(
      withChildName(`Add ${NAME_TOKEN}`, { childName: "  Ivy  " }),
      "Add Ivy",
    );
  });

  it("still reads correctly with no name to substitute", () => {
    // Unreachable while the ready check holds, which is exactly why it
    // has to be checked here instead of noticed in production.
    assert.equal(
      withChildName(`When was ${NAME_TOKEN} born?`, {}),
      "When was your child born?",
    );
    assert.equal(
      withChildName(`When was ${NAME_TOKEN} born?`, { childName: "   " }),
      "When was your child born?",
    );
  });
});

describe("the card only claims what it did", () => {
  it("shows no saved receipt before anything is saved", () => {
    for (const kind of KINDS) {
      const html = renderCard(kind);
      assert.ok(!html.includes("Saved"), `${kind} claimed a save on first render`);
      assert.ok(!html.includes("Added"), `${kind} claimed an add on first render`);
    }
  });

  it("renders nothing once superseded without being filled", () => {
    const html = renderToStaticMarkup(
      <DetailCard card={{ kind: "child", intro: null }} active={false} onSaved={() => {}} />,
    );
    assert.equal(html, "");
  });
});

describe("spokenDate", () => {
  it("keeps the day the parent picked", () => {
    // new Date("2018-04-12") is UTC midnight and prints April 11 anywhere
    // west of Greenwich. A birthday is the one date she will notice.
    assert.equal(spokenDate("2018-04-12"), "April 12, 2018");
  });

  it("reads like a person, not a database", () => {
    assert.ok(!spokenDate("2018-04-12").includes("-"));
  });

  it("passes through anything it cannot parse", () => {
    assert.equal(spokenDate("nonsense"), "nonsense");
    assert.equal(spokenDate(undefined), "");
  });
});
