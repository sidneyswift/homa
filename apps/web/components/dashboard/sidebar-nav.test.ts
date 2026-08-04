import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  APP_NAV_GROUPS,
  APP_NAV_ITEMS,
  isAppNavItemActive,
} from "./sidebar-nav";

const SIDEBAR_SOURCE = readFileSync(
  new URL("./sidebar.tsx", import.meta.url),
  "utf8",
);
const GLOBALS_CSS = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const QUIET_PRIMITIVES_CSS = readFileSync(
  new URL("../design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("isAppNavItemActive", () => {
  it("exposes the approved Progress navigation item", () => {
    const progressItem = APP_NAV_ITEMS.find(
      (item) => item.label === "Progress",
    );

    assert.equal(progressItem?.href, "/app/progress");
  });

  it("keeps Calendar and Hours inside one Planner navigation item", () => {
    const plannerItem = APP_NAV_ITEMS.find((item) => item.label === "Planner");

    assert.equal(plannerItem?.href, "/app/planner");
    const labels = APP_NAV_ITEMS.map((item) => String(item.label));
    assert.equal(labels.includes("Calendar"), false);
    assert.equal(labels.includes("Hours"), true);
    assert.equal(APP_NAV_ITEMS.find((item) => item.label === "Hours")?.group, "work");
  });

  it("keeps the binding primary and secondary navigation hierarchy", () => {
    assert.deepEqual(APP_NAV_GROUPS.map((group) => group.label), [null, "Your work"]);
    assert.deepEqual(
      APP_NAV_GROUPS.map((group) => group.items.map((item) => item.label)),
      [
        ["Chat", "Progress", "Planner", "Tasks"],
        ["Library", "Binder", "Hours"],
      ],
    );
  });

  it("exposes the family-owned Library beside Binder (issue #352)", () => {
    const libraryItem = APP_NAV_ITEMS.find((item) => item.label === "Library");

    assert.equal(libraryItem?.href, "/app/library");
  });

  it("lights Progress on live child and index routes", () => {
    assert.equal(
      isAppNavItemActive("/app/progress", "/app/progress"),
      true,
    );
    assert.equal(
      isAppNavItemActive(
        "/app/progress",
        "/app/child-1/progress",
      ),
      true,
    );
  });

  it("keeps Progress lit on legacy fallback routes", () => {
    assert.equal(
      isAppNavItemActive("/app/progress", "/app/report"),
      true,
    );
    assert.equal(
      isAppNavItemActive(
        "/app/progress",
        "/app/child-1/report",
      ),
      true,
    );
  });

  it("keeps the agent route exact", () => {
    assert.equal(isAppNavItemActive("/app", "/app"), true);
    assert.equal(
      isAppNavItemActive("/app", "/app/progress"),
      false,
    );
  });
});

describe("desktop sidebar visibility", () => {
  it("uses the Quiet frame as a dedicated screen-only host", () => {
    assert.match(SIDEBAR_SOURCE, /<QuietFrame/u);
    assert.match(SIDEBAR_SOURCE, /data-app-rail=""/u);
    assert.doesNotMatch(SIDEBAR_SOURCE, /<aside/u);
    assert.match(
      SIDEBAR_SOURCE,
      /data-app-rail=""\s+role="complementary"\s+aria-label="App sidebar"/u,
    );
    assert.match(SIDEBAR_SOURCE, /className="quiet-shell__rail"/u);
    assert.doesNotMatch(SIDEBAR_SOURCE, /app-sidebar/u);
    assert.doesNotMatch(GLOBALS_CSS, /\.app-sidebar/u);
    assert.match(QUIET_PRIMITIVES_CSS, /\.quiet-shell__rail\s*\{\s*display:\s*none/u);
    assert.match(
      QUIET_PRIMITIVES_CSS,
      /@media screen and \(min-width:\s*64rem\)\s*\{[\s\S]*?\.quiet-shell__rail\s*\{\s*display:\s*flex !important/u,
    );
  });
});

describe("Quiet signed-in shell contract", () => {
  const SHELL_SOURCES = [
    SIDEBAR_SOURCE,
    readFileSync(new URL("./sidebar-nav.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("./shell.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("./mobile-nav.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("./context-switcher.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("./account-menu.tsx", import.meta.url), "utf8"),
  ].join("\n");

  it("routes shell geometry and actions through Quiet primitives", () => {
    assert.match(SHELL_SOURCES, /QuietFrame/u);
    assert.match(SHELL_SOURCES, /QuietAction/u);
    assert.match(SHELL_SOURCES, /QuietStatus/u);
    assert.match(SHELL_SOURCES, /quiet-shell__nav-item--active/u);
    assert.match(SHELL_SOURCES, /quiet-shell__context-live/u);
  });

  it("does not reintroduce compatibility palette classes into the shell", () => {
    assert.doesNotMatch(
      SHELL_SOURCES,
      /bg-page|bg-card|border-border-subtle|shadow-\[var\(--shadow|text-subtle|text-body|bg-brand/u,
    );
  });

  it("keeps reduced motion and 44px interaction targets in the shell CSS", () => {
    assert.match(QUIET_PRIMITIVES_CSS, /\.quiet-shell__icon-action\s*\{[\s\S]*width:\s*44px/u);
    assert.match(QUIET_PRIMITIVES_CSS, /\.quiet-shell__nav-item\s*\{[\s\S]*min-height:\s*44px/u);
    assert.match(QUIET_PRIMITIVES_CSS, /@media \(prefers-reduced-motion:\s*reduce\)/u);
  });

  it("gives the mobile drawer a dialog, exit, and focus lifecycle", () => {
    const mobileSource = readFileSync(new URL("./mobile-nav.tsx", import.meta.url), "utf8");
    assert.match(mobileSource, /role="dialog"/u);
    assert.match(mobileSource, /aria-modal="true"/u);
    assert.match(mobileSource, /data-closing=/u);
    assert.match(mobileSource, /onTransitionEnd=/u);
    assert.match(mobileSource, /triggerRef\.current\?\.focus/u);
    assert.match(mobileSource, /FOCUSABLE_SELECTOR/u);
    assert.match(QUIET_PRIMITIVES_CSS, /\.quiet-shell__drawer\[data-closing="true"\]/u);
  });

  it("routes page gutters through the Workspace geometry contract", () => {
    const pageColumnSource = readFileSync(new URL("./page-column.tsx", import.meta.url), "utf8");
    assert.match(pageColumnSource, /<Workspace/u);
    assert.match(pageColumnSource, /quiet-workspace__content/u);
    assert.doesNotMatch(pageColumnSource, /px-5|lg:px-10|max-w-\[1040px\]/u);
  });
});
