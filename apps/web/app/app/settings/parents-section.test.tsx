import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { shouldOpenSignedInAdultPhoneEditor } from "./page";
import { ParentsSection, type AdultRow } from "./parents-section";

const SETTINGS_PAGE_SOURCE = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const ADULTS: AdultRow[] = [
  {
    userId: "11111111-1111-4111-8111-111111111111",
    name: "Sarah",
    isYou: true,
    isPrimary: true,
    avatarUrl: null,
    email: "sarah@example.com",
    phoneDisplay: "(954) 555-0123",
  },
  {
    userId: "22222222-2222-4222-8222-222222222222",
    name: "Ben",
    isYou: false,
    isPrimary: false,
    avatarUrl: null,
    email: "ben@example.com",
    phoneDisplay: "(954) 555-0456",
  },
];

function renderParentsSection(
  openSignedInAdultPhoneEditor: boolean,
): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <ParentsSection
        adults={ADULTS}
        pendingInvites={[]}
        legacyPhones={[]}
        homaNumberDisplay={null}
        homaNumberE164={null}
        openSignedInAdultPhoneEditor={openSignedInAdultPhoneEditor}
      />
    </AppRouterContext.Provider>,
  );
}

describe("Parents settings phone editor destination", () => {
  it("uses the semantic Quiet icon adapter for the call affordance", () => {
    assert.match(SETTINGS_PAGE_SOURCE, /data-brand-surface="settings"/u);
    const source = readFileSync(new URL("./parents-section.tsx", import.meta.url), "utf8");
    assert.match(source, /<Icon name="chat"/u);
    assert.doesNotMatch(source, /from "lucide-react"/u);
  });

  it("opens only for the exact server-derived phone edit request", () => {
    assert.equal(shouldOpenSignedInAdultPhoneEditor("phone"), true);
    for (const value of [undefined, "profile", ["phone"]] as const) {
      assert.equal(shouldOpenSignedInAdultPhoneEditor(value), false);
    }
    assert.match(
      SETTINGS_PAGE_SOURCE,
      /openSignedInAdultPhoneEditor=\{shouldOpenSignedInAdultPhoneEditor\(edit\)\}/u,
    );
  });

  it("keeps the signed-in adult editor collapsed by default", () => {
    const html = renderParentsSection(false);
    assert.match(html, />Edit<\/button>/u);
    assert.doesNotMatch(html, /Your cell number|name="phone"/u);
  });

  it("opens the signed-in adult's existing editor without editing another adult", () => {
    const html = renderParentsSection(true);
    assert.equal(html.match(/Your cell number/gu)?.length, 1);
    assert.equal(html.match(/name="phone"/gu)?.length, 1);
    assert.match(
      html,
      /id="my-phone"[^>]*value="\(954\) 555-0123"/u,
    );
    assert.match(html, /Ben/);
    assert.doesNotMatch(html, /value="\(954\) 555-0456"/u);
  });
});
