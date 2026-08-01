import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GrowthChart } from "./growth-chart";

function days(totals: number[], startDay = 6): { day: string; total: number }[] {
  return totals.map((total, i) => ({
    day: `2026-07-${String(startDay + i).padStart(2, "0")}`,
    total,
  }));
}

describe("GrowthChart", () => {
  it("prints all four endpoints, week labels, and the launch marker", () => {
    const startedOnboarding = days(
      [1, 2, 2, 3, 4, 4, 4, 10, 25, 40, 52, 58, 60, 62, 63, 64, 66, 68],
      6, // Jul 6 (a Monday in 2026; Jul 12 and 19 are the Sundays)
    );
    const accounts = days(
      [1, 2, 2, 3, 3, 3, 4, 8, 20, 32, 40, 44, 45, 46, 47, 48, 48, 49],
      6,
    );
    const setupDone = days(
      [0, 1, 1, 2, 3, 3, 3, 7, 18, 30, 36, 37, 38, 38, 38, 39, 39, 39],
      6,
    );
    const trialStarted = days(
      [0, 0, 0, 0, 0, 0, 0, 1, 4, 8, 12, 14, 15, 16, 17, 17, 18, 19],
      6,
    );
    const html = renderToStaticMarkup(
      <GrowthChart series={{ startedOnboarding, accounts, setupDone, trialStarted }} />,
    );

    assert.match(html, />68</u);
    assert.match(html, />email collected</u);
    assert.match(html, />49</u);
    assert.match(html, />created account</u);
    assert.match(html, />39</u);
    assert.match(html, />added a child</u);
    assert.match(html, />19</u);
    assert.match(html, />trial started</u);
    assert.match(html, />launch</u);
    assert.match(html, /Jul 12/u);
    assert.match(html, /Jul 19/u);
    // Gridlines step 20 at max 68: labels 0 through 80, scaled by signups.
    assert.match(html, />80</u);
    assert.match(html, />0</u);
    assert.match(html, /--clay-500/u);
    assert.match(html, /--sky-600/u);
    assert.match(html, /--sage-500/u);
    assert.match(html, /--gold-500/u);
  });

  it("uses a 10 step for small fleets and survives missing lower lines", () => {
    const html = renderToStaticMarkup(
      <GrowthChart series={{ startedOnboarding: days([2, 5, 9, 14]), accounts: [], setupDone: [], trialStarted: [] }} />,
    );
    assert.match(html, />20</u);
    assert.doesNotMatch(html, />40</u);
    assert.doesNotMatch(html, />created account</u);
    assert.doesNotMatch(html, />added a child</u);
    assert.doesNotMatch(html, />trial started</u);
  });

  it("asks for patience under two points", () => {
    const html = renderToStaticMarkup(
      <GrowthChart series={{ startedOnboarding: days([1]), accounts: [], setupDone: [], trialStarted: [] }} />,
    );
    assert.match(html, /The growth line starts after two days of email collection\./u);
  });
});
