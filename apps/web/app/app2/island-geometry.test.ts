import assert from "node:assert/strict";
import test from "node:test";

import { fitIsland, resolveIslandPlacement } from "./island-geometry.ts";

test("placement uses the supplied region, not the page origin", () => {
  assert.equal(resolveIslandPlacement(220, 200, 600), "top");
  assert.equal(resolveIslandPlacement(500, 200, 600), "center");
  assert.equal(resolveIslandPlacement(780, 200, 600), "bottom");
});

test("small layout jitter does not flip the anchored edge", () => {
  assert.equal(resolveIslandPlacement(201, 0, 600, "top"), "top");
  assert.equal(resolveIslandPlacement(199, 0, 600, "center"), "center");
  assert.equal(resolveIslandPlacement(399, 0, 600, "bottom"), "bottom");
  assert.equal(resolveIslandPlacement(500, 0, 600, "top"), "bottom");
});

test("height changes preserve the top, center or bottom anchor when there is room", () => {
  for (const origin of [0, 0.5, 1]) {
    for (const height of [62, 160, 240]) {
      const result = fitIsland({ x: 400, y: 400, width: 300, height, origin,
        bounds: { left: 0, top: 0, right: 800, bottom: 800 } });
      assert.equal(result.offsetX, 0);
      assert.equal(result.offsetY, 0);
    }
  }
});

test("a keyboard obstruction lifts the bottom dock into the visible viewport", () => {
  const result = fitIsland({ x: 195, y: 760, width: 358, height: 62, origin: 1,
    bounds: { left: 0, top: 0, right: 390, bottom: 430 } });
  assert.equal(result.offsetY, -330);
  assert.equal(760 + result.offsetY, 430);
});

test("oversized contents are bounded without reducing control sizes", () => {
  const result = fitIsland({ x: 500, y: 500, width: 780, height: 500, origin: 0.5,
    bounds: { left: 20, top: 100, right: 300, bottom: 400 } });
  assert.equal(result.maxWidth, 280);
  assert.equal(result.maxHeight, 300);
  assert.equal(500 + result.offsetX, 160);
  assert.equal(500 + result.offsetY, 250);
});
