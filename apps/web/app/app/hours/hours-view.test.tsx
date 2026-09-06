import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { scopedToViewContext, type HoursEntry } from "../../../lib/hours-view";
import { HoursEntryForm, HoursEntryOverlay } from "./hours-entry-overlay";
import { HoursView, type HoursKid } from "./hours-view";

/**
 * The Hours page and its editor dialog (CG-02, issue #174). Same posture
 * as the Tasks and Progress UI tests: static server render, assertions
 * on the HTML contract, no browser. Interactivity (opening the dialog,
 * confirming a delete) is owned by the same click-handled state the
 * Tasks editor already exercises this way.
 */

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const MAYA: HoursKid = { id: "child-maya", name: "Maya", avatar_url: null };
const LEO: HoursKid = { id: "child-leo", name: "Leo", avatar_url: null };

function entry(overrides: Partial<HoursEntry> = {}): HoursEntry {
  return {
    id: "entry-1",
    childId: "child-maya",
    childName: "Maya",
    subject: "math",
    customLabel: null,
    minutes: 45,
    happenedOn: "2026-07-11",
    source: "chat",
    note: null,
    ...overrides,
  };
}

// Saturday Jul 11, 2026, 6pm in New York (matches the Tasks fixture).
const RENDER_NOW = new Date("2026-07-11T22:00:00.000Z");

function renderView(
  entries: HoursEntry[],
  kids: HoursKid[] = [MAYA],
  focusChildId: string | null = null,
): string {
  return renderToStaticMarkup(
    <HoursView entriesComplete schoolYearStartOn="2020-07-01"
      kids={kids}
      entries={entries}
      focusChildId={focusChildId}
      timeZone="America/New_York"
      now={RENDER_NOW}
    />,
  );
}

function renderOverlay(entryToEdit: HoursEntry): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <HoursEntryOverlay entry={entryToEdit} onClose={() => {}} />
    </AppRouterContext.Provider>,
  );
}

function renderForm(entryToEdit: HoursEntry): string {
  return renderToStaticMarkup(<HoursEntryForm context={{ result: "ready", revision: "a".repeat(32), entry: entryToEdit, activity: null }} pending={null} onSave={() => {}} onClose={() => {}} />);
}

describe("HoursView", () => {
  it("withholds every aggregate when only part of the record loaded", () => {
    const html = renderToStaticMarkup(<HoursView entriesComplete={false} schoolYearStartOn="2020-07-01"
      kids={[MAYA]} entries={[entry()]} focusChildId={MAYA.id}
      timeZone="America/New_York" now={RENDER_NOW} />);
    assert.match(html, /Only part of the Hours record loaded\. Totals are unavailable\./u);
    assert.match(html, /<h2[^>]*>Today<\/h2>/u);
    assert.doesNotMatch(html, /<h2[^>]*>Today<\/h2><span/u);
    assert.doesNotMatch(html, /This week<\/dt>|This month<\/dt>|School year<\/dt>/u);
    assert.match(html, />45m</u);
  });

  it("shows the day total only with a complete record receipt", () => {
    const html = renderView([entry()]);
    assert.match(html, /<h2[^>]*>Today<\/h2><span[^>]*>45m<\/span>/u);
  });

  it("explains the selected child's shared time in embedded Hours", () => {
    const rows = [entry(), entry({ id: "shared", childId: null, childName: null, minutes: 5 }),
      entry({ id: "leo", childId: LEO.id, childName: LEO.name, minutes: 60 })];
    const html = renderToStaticMarkup(<HoursView entriesComplete schoolYearStartOn="2020-07-01" kids={[MAYA, LEO]}
      entries={scopedToViewContext(rows, { kind: "child", childId: MAYA.id })}
      focusChildId={MAYA.id} timeZone="America/New_York" now={RENDER_NOW} embedded />);
    assert.match(html, /Showing Maya&#x27;s recorded time, including time shared with the whole family\./u);
    assert.match(html, /50m/u);
    assert.doesNotMatch(html, /60m|>Leo</u);
  });

  it("keeps whole-family scope visible for one child and empty embedded records", () => {
    const html = renderToStaticMarkup(<HoursView entriesComplete schoolYearStartOn="2020-07-01" kids={[MAYA]} entries={[]} focusChildId={null}
      timeZone="America/New_York" now={RENDER_NOW} embedded />);
    assert.match(html, /Showing recorded time for the whole family\./u);
  });
  it("projects the log and editor onto the Quiet authority surface contract", () => {
    const html = renderView([entry()]);
    assert.match(html, /data-brand-surface="hours"/u);
    assert.match(html, /data-brand-fixture="quiet-authority-v1"/u);
    assert.match(html, /quiet-frame quiet-frame--paper/u);
    assert.match(html, /quiet-action quiet-action--quiet/u);
    assert.doesNotMatch(html, /clay|bg-brand|text-brand|Schibsted|Hanken|Caveat/u);

    const overlay = renderOverlay(entry());
    assert.match(overlay, /quiet-artifact-backdrop/u);
    assert.match(overlay, /quiet-artifact-dialog/u);
    assert.match(renderForm(entry()), /quiet-action quiet-action--primary/u);
    assert.doesNotMatch(overlay, /clay|bg-brand|text-brand|Schibsted|Hanken|Caveat/u);
  });

  it("shows the reassuring empty state with nothing logged", () => {
    const html = renderView([]);
    assert.match(html, /Nothing logged yet\./);
    assert.match(html, /Tell Homa how long schoolwork took in Chat, by text, or on a call/);
    assert.doesNotMatch(html, /role="dialog"/);
  });

  it("renders one totals card per visible child with week, month, and school-year figures", () => {
    const html = renderView(
      [entry({ id: "a", childId: "child-maya", happenedOn: "2026-07-11", minutes: 45 })],
      [MAYA, LEO],
    );
    assert.match(html, />Maya<\/span>/);
    assert.match(html, />Leo<\/span>/);
    assert.match(html, />This week<\/dt>/);
    assert.match(html, />This month<\/dt>/);
    assert.match(html, />School year<\/dt>/);
    assert.match(html, /School-year totals: Jul 1, 2026 through today\./u);
  });

  it("narrows totals to the focused kid only, never their sibling", () => {
    // page.tsx pre-scopes entries with scopedToViewContext before handing
    // them to the view; HoursView itself only narrows the totals cards
    // (kids full roster stays, for stable avatar tones).
    const entries = scopedToViewContext(
      [
        entry({ id: "a", childId: "child-maya" }),
        entry({ id: "b", childId: "child-leo", childName: "Leo" }),
      ],
      { kind: "child", childId: "child-maya" },
    );
    const html = renderView(entries, [MAYA, LEO], "child-maya");
    assert.match(html, />Maya<\/span>/);
    assert.doesNotMatch(html, />Leo<\/span>/);
    assert.match(html, /Homa records the school time you tell her about for Maya/);
  });

  it("groups entries under Today with subject, minutes, note, and an easy Edit target", () => {
    const html = renderView([
      entry({ id: "a", subject: "reading", minutes: 30, note: "About 30 min of phonics" }),
    ]);
    assert.match(html, />Today<\/h2>/);
    assert.match(html, />Reading<\/span>/);
    assert.match(html, />30m<\/span>/);
    assert.match(html, /About 30 min of phonics/);
    assert.match(html, /quiet-action quiet-action--quiet/);
    assert.match(html, />Edit<\/span>/);
  });

  it("keeps source provenance behind Edit instead of competing with the activity", () => {
    assert.doesNotMatch(renderView([entry({ source: "call" })]), /Phone call/);
    assert.match(renderForm(entry({ source: "chat" })), /Saved in School hours\./);
    assert.doesNotMatch(renderForm(entry({ source: "chat" })), /mentioned it in Chat/);
    assert.match(renderForm(entry({ source: "sms" })), /Added after you mentioned it by text\./);
    assert.match(renderForm(entry({ source: "call" })), /Added after you mentioned it on a phone call\./);
    assert.match(renderForm(entry({ source: "email" })), /Added after you mentioned it by email\./);
    assert.match(renderForm(entry({ source: "dispatch" })), /Added by Homa during a scheduled check-in\./);
  });

  it("shows which child a block belongs to only when more than one kid exists", () => {
    // The child-badge span carries its own distinct classes, unlike the
    // totals card's name (which always renders "Maya" regardless).
    const soloHtml = renderView([entry({ childId: "child-maya" })], [MAYA]);
    assert.doesNotMatch(soloHtml, /text-xs font-semibold text-\[color:color-mix\(in_srgb,var\(--homa-ink\)_52%,var\(--homa-canvas\)\)\]">Maya</);

    const multiHtml = renderView(
      [
        entry({ id: "a", childId: "child-maya" }),
        entry({ id: "b", childId: null, childName: null, happenedOn: "2026-07-10" }),
      ],
      [MAYA, LEO],
    );
    assert.match(multiHtml, /text-xs font-semibold text-\[color:color-mix\(in_srgb,var\(--homa-ink\)_52%,var\(--homa-canvas\)\)\]">Maya</);
    assert.match(multiHtml, /text-xs font-semibold text-\[color:color-mix\(in_srgb,var\(--homa-ink\)_52%,var\(--homa-canvas\)\)\]">Whole family</);
  });

  it("only shows the subject filter chips when more than one subject is present", () => {
    const oneSubject = renderView([entry({ subject: "math" })]);
    assert.doesNotMatch(oneSubject, /Filter by subject/);

    const twoSubjects = renderView([
      entry({ id: "a", subject: "math" }),
      entry({ id: "b", subject: "reading", happenedOn: "2026-07-10" }),
    ]);
    assert.match(twoSubjects, /aria-label="Filter by subject"/);
    assert.match(twoSubjects, /aria-pressed="true"[^>]*>\s*All\s*<\/button>/);
    assert.match(twoSubjects, />Reading<\/button>/);
    assert.match(twoSubjects, />Math<\/button>/);
  });
});

describe("HoursEntryOverlay", () => {
  it("opens prefilled with the entry's own subject, minutes, and note", () => {
    const html = renderForm(entry({ subject: "science", minutes: 90, note: "Volcano experiment" }));
    const overlay = renderOverlay(entry());
    assert.match(overlay, /role="dialog"/);
    assert.match(overlay, /aria-modal="true"/);
    assert.match(overlay, /<h2 id="hours-entry-title"[^>]*>Edit recorded time<\/h2>/);
    assert.match(html, /<option value="science" selected="">Science<\/option>/);
    assert.match(html, /name="minutes"[^>]*value="90"/);
    assert.match(html, /Volcano experiment/);
    assert.match(html, />Save changes<\/span>/);
  });

  it("names who the block is for, or the whole family", () => {
    const forKid = renderForm(entry({ childName: "Maya" }));
    assert.match(forKid, /Recorded time for Maya\./);
    assert.match(forKid, /Saved in School hours\./);

    const familyWide = renderForm(entry({ childId: null, childName: null }));
    assert.match(familyWide, /Recorded time for the whole family\./);
  });

  it("loads authenticated scope before offering any write", () => {
    const html = renderOverlay(entry());
    assert.match(html, /Loading the time record/);
    assert.doesNotMatch(html, /Delete recorded time/);
    assert.doesNotMatch(html, /name="minutes"/);
    assert.doesNotMatch(html, /can&#x27;t be undone/);
  });
});
