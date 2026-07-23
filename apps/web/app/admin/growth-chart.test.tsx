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
  it("prints the current total, week labels, and the launch marker", () => {
    const points = days(
      [1, 2, 2, 3, 4, 4, 4, 10, 25, 40, 52, 58, 60, 62, 63, 64, 66, 68],
      6, // Jul 6 (a Monday in 2026; Jul 12 and 19 are the Sundays)
    );
    const html = renderToStaticMarkup(<GrowthChart points={points} />);

    assert.match(html, />68</u);
    assert.match(html, />families</u);
    assert.match(html, />launch</u);
    assert.match(html, /Jul 12/u);
    assert.match(html, /Jul 19/u);
    // Gridlines step 20 at max 68: labels 0 through 80.
    assert.match(html, />80</u);
    assert.match(html, />0</u);
  });

  it("uses a 10 step for small fleets", () => {
    const html = renderToStaticMarkup(<GrowthChart points={days([2, 5, 9, 14])} />);
    assert.match(html, />20</u);
    assert.doesNotMatch(html, />40</u);
  });

  it("asks for patience under two points", () => {
    const html = renderToStaticMarkup(<GrowthChart points={days([1])} />);
    assert.match(html, /The growth line starts once two days of signups exist\./u);
  });
});
