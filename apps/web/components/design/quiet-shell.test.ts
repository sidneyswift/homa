import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { QUIET_FOOTER_COLUMNS } from "./QuietFooter";
import { QUIET_NAV_LINKS } from "./QuietNav";

const PRIMITIVES_CSS = readFileSync(
  new URL("./quiet-primitives.css", import.meta.url),
  "utf8",
);

test("Quiet nav preserves the public destinations and their order", () => {
  assert.deepEqual(QUIET_NAV_LINKS, [
    ["How it works", "/#how"],
    ["Features", "/#features"],
    ["Memberships", "/#memberships"],
    ["Our story", "/#stories"],
  ]);
});
test("Quiet footer keeps one canonical link set for every public shell", () => {
  const labels = QUIET_FOOTER_COLUMNS.flatMap(([, links]) => links.map(([label]) => label));
  assert.deepEqual(labels, [
    "Your child's progress report",
    "How the report works",
    "Homeschool planner",
    "Hours and state rules",
    "Features",
    "Our story",
    "Blog",
    "Start with Homa",
    "Privacy",
    "Terms",
    "Contact",
  ]);
});

test("Quiet shell CSS has accessible overlay and reduced-motion states", () => {
  assert.match(PRIMITIVES_CSS, /\.quiet-nav__backdrop/);
  assert.match(PRIMITIVES_CSS, /\.quiet-nav__menu\[data-closing="true"\]/);
  assert.match(PRIMITIVES_CSS, /prefers-reduced-motion: reduce/);
  assert.match(PRIMITIVES_CSS, /\.quiet-nav__menu-link:focus-visible/);
  assert.match(PRIMITIVES_CSS, /\.quiet-footer__links a:focus-visible/);
});
