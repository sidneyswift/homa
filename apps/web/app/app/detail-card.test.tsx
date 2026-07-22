import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DetailCard,
  FIELDS,
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
    assert.ok(html.includes(FIELDS.child[0].label), "did not open on step one");
    assert.ok(!html.includes(FIELDS.child[1].label), "showed a later step too");
  });

  it("labels the button Next until the last question", () => {
    assert.ok(renderCard("child").includes("Next"));
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
