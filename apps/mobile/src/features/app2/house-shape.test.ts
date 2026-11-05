import assert from "node:assert/strict";
import { test } from "node:test";

import { logoGeometry } from "@homa/design/contract";

import { houseShape } from "./house-shape";

test("the generated house path becomes a centered, closed outline", () => {
  const points = houseShape(logoGeometry.housePath).getPoints(16);
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  // The mark spans x 4.6..43.4 and y 5.6..44 in its 48-unit box.
  assert.ok(Math.abs(Math.min(...xs) + 19.4) < 0.01);
  assert.ok(Math.abs(Math.max(...xs) - 19.4) < 0.01);
  assert.ok(Math.abs(Math.min(...ys) + 19.2) < 0.01);
  assert.ok(Math.abs(Math.max(...ys) - 19.2) < 0.01);
  assert.deepEqual(points[0], points.at(-1));
});

test("a path command the parser does not support fails loudly", () => {
  assert.throws(() => houseShape("M0 0 A 4 4 0 0 1 8 8 Z"), /Unsupported house path command: A/);
  assert.throws(() => houseShape("M0 0 L4"), /ended inside a L command/);
});
