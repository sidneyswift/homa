/** Local, synthetic #1095 artifact proof. Uses the production packet composer
 * and renderer; creates no account, document record or remote artifact. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { composeStatePack } from "../apps/web/lib/compliance/pack";
import { parseStateRequirementsPayload, type StateRequirementsSummary } from "../apps/web/lib/map/state-requirements";
import { closePrintableRenderer, renderPrintableHtml } from "../apps/web/lib/materials/render-page";

const requireWeb = createRequire(resolve("apps/web/package.json"));
const { getDocument } = requireWeb("pdfjs-dist/legacy/build/pdf.mjs");
const out = process.env.HOURS_RECORD_PDF_EVIDENCE_DIR ?? "/tmp/homa-hours-record-pack";
mkdirSync(out, { recursive: true });
const index = JSON.parse(readFileSync("data/state-requirements/index.json", "utf8"));
const entry = index.states.find((state: { state_code: string }) => state.state_code === "NY");
const payload = JSON.parse(readFileSync("data/state-requirements/states/NY.json", "utf8"));
const summary: StateRequirementsSummary = {
  stateCode: entry.state_code, stateName: entry.state_name, regulationLevel: entry.regulation_level,
  compulsoryStartAge: entry.compulsory_education.start_age, compulsoryEndAge: entry.compulsory_education.end_age,
  notificationRequired: entry.notification_required, assessmentRequired: entry.assessment_required,
  defaultPathway: entry.default_pathway, sourcePageUrl: payload.page_url, sourceLastVerified: entry.last_verified,
};
const detail = parseStateRequirementsPayload(summary, payload);
const family = { familyName: "Record fixture", parentName: "Synthetic parent", children: [
  { id: "11111111-1111-4111-8111-111111111111", name: "Same", birthdate: "2018-03-09" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Same", birthdate: "2020-11-21" },
] };
const records = { schoolYearStartOn: "2026-09-01", entries: [
  { childId: family.children[0].id, childName: "Same", happenedOn: "2026-09-01", subject: "reading", minutes: 20 },
  { childId: family.children[1].id, childName: "Same", happenedOn: "2026-09-01", subject: "math", minutes: 30 },
  { childId: null, childName: null, happenedOn: "2026-09-02", subject: "art", minutes: 10 },
] };
const receipts = [];
try {
  for (const renamed of [false, true]) {
    const currentFamily = { ...family, children: family.children.map((child, i) => ({ ...child, name: renamed && i === 0 ? "Renamed" : child.name })) };
    const currentRecords = { ...records, entries: records.entries.map((row) => ({ ...row, childName: row.childId === currentFamily.children[0].id ? currentFamily.children[0].name : row.childName })) };
    const pack = composeStatePack({ detail, family: currentFamily, records: currentRecords,
      packId: "12345678-abcd-4ef0-8123-456789abcdef", generatedOn: "September 6, 2026" });
    const rendered = await renderPrintableHtml(pack.html);
    assert.equal(rendered.pageCount, pack.pages.length, "Printed page count matches the composed packet");
    assert.equal(rendered.renderer, "pdfjs-raster", "Evidence images come from the actual PDF");
    const loadingTask = getDocument({ data: new Uint8Array(rendered.pdf), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    const text: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      text.push(content.items.filter((item: { str?: string }) => typeof item.str === "string").map((item: { str: string }) => item.str).join(" "));
    }
    const summaryIndex = pack.pages.findIndex((page) => page.title === "Recorded learning days and hours");
    const detailsIndex = pack.pages.findIndex((page) => page.title === "Logged learning days");
    assert.match(text[summaryIndex], renamed ? /Renamed\s+2\s+30m/u : /Same \(record 111111\)\s+2\s+30m/u);
    assert.match(text[summaryIndex], renamed ? /Same\s+2\s+40m/u : /Same \(record 222222\)\s+2\s+40m/u);
    assert.match(text[summaryIndex], /does not establish absence/u);
    assert.match(text[detailsIndex], renamed ? /Renamed: reading, 20m/u : /Same \(record 111111\): reading, 20m/u);
    assert.match(text[detailsIndex], renamed ? /Same: math, 30m/u : /Same \(record 222222\): math, 30m/u);
    assert.match(text[detailsIndex], /Whole family: art, 10m/u);
    const stem = renamed ? "renamed" : "same-name";
    writeFileSync(resolve(out, `${stem}.pdf`), rendered.pdf);
    writeFileSync(resolve(out, `${stem}-text.json`), JSON.stringify(text, null, 2));
    for (const [kind, i] of [["summary", summaryIndex], ["details", detailsIndex]] as const) {
      assert.ok(rendered.pageJpegs[i], "Target record page is present in rasterized evidence");
      writeFileSync(resolve(out, `${stem}-${kind}.jpg`), rendered.pageJpegs[i]);
    }
    receipts.push({ stem, pageCount: rendered.pageCount, renderer: rendered.renderer, rendererVersion: rendered.rendererVersion,
      pdfSha256: createHash("sha256").update(rendered.pdf).digest("hex"), summaryPage: summaryIndex + 1, detailPage: detailsIndex + 1,
      childTotals: [{ id: family.children[0].id, minutes: 30, days: 2 }, { id: family.children[1].id, minutes: 40, days: 2 }] });
    await loadingTask.destroy();
  }
  const sourcePaths = ["apps/web/lib/compliance/pack.ts", "apps/web/lib/hours-record-scope.ts", "apps/web/lib/materials/render-page.ts", "scripts/hours-record-pack-smoke.mts"];
  writeFileSync(resolve(out, "receipt.json"), JSON.stringify({ createdAt: new Date().toISOString(), receipts,
    sources: Object.fromEntries(sourcePaths.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
    boundary: "Synthetic records, actual composer, Chrome print and PDF text/raster. No hosted route, account, stored material, legal certification or physical printer." }, null, 2));
  console.log(JSON.stringify({ passed: true, artifacts: out, receipts }));
} finally {
  await closePrintableRenderer();
}
