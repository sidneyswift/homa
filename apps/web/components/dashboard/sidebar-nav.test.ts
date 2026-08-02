import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
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
    assert.equal(labels.includes("Hours"), false);
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
  it("uses a dedicated screen-only host that cannot be filtered as an aside", () => {
    assert.match(SIDEBAR_SOURCE, /<div\s+data-app-sidebar/u);
    assert.doesNotMatch(SIDEBAR_SOURCE, /<aside/u);
    assert.match(
      SIDEBAR_SOURCE,
      /data-app-sidebar=""\s+role="complementary"\s+aria-label="App sidebar"/u,
    );
    assert.match(SIDEBAR_SOURCE, /className="app-sidebar /u);
    assert.doesNotMatch(SIDEBAR_SOURCE, /hidden.*lg:flex|lg:flex.*hidden/u);
    assert.match(
      GLOBALS_CSS,
      /\.app-sidebar\s*\{\s*display:\s*none;\s*\}/u,
    );
    assert.match(
      GLOBALS_CSS,
      /@media screen and \(min-width:\s*64rem\)\s*\{\s*\.app-sidebar\s*\{\s*display:\s*flex !important;\s*\}/u,
    );
  });
});
