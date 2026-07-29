/**
 * Disposable local proof for the filing document (gh#421): composes the
 * filing for real states from the repository's reviewed snapshots,
 * renders it through the real shell and the real renderer, and checks
 * that a notice is exactly one page.
 *
 * The overflow law bites harder here than on the pack. A notice that
 * spills onto a second page is not a longer document, it is an
 * incomplete legal filing that a family mails believing they complied,
 * so this refuses rather than reporting.
 *
 * Needs local Chrome; writes artifacts to /tmp/filing-smoke for eyeball
 * and physical-print review. Not wired into CI (it needs a browser
 * binary); run by hand:
 *   pnpm tsx scripts/filing-render-smoke.mts [CODE ...|all]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const { parseStateRequirementsPayload } = await import(
  "../apps/web/lib/map/state-requirements"
);
const { composeFilingLetter } = await import(
  "../apps/web/lib/compliance/filing-letter"
);
const { wrapFilingDocument } = await import(
  "../apps/web/lib/compliance/filing-document"
);
const { FILING_METHODS_BY_STATE } = await import(
  "../apps/web/lib/compliance/filing-methods.data"
);
const { closePrintableRenderer, renderPrintableHtml } = await import(
  "../apps/web/lib/materials/render-page"
);

const outDir = "/tmp/filing-smoke";
mkdirSync(outDir, { recursive: true });

const index = JSON.parse(
  readFileSync("data/state-requirements/index.json", "utf8"),
) as {
  states: {
    state_code: string;
    state_name: string;
    regulation_level: "none" | "low" | "moderate" | "high";
    compulsory_education: { start_age: number | null; end_age: number | null };
    notification_required: boolean;
    assessment_required: boolean;
    default_pathway: string | null;
    last_verified: string;
  }[];
};

function loadDetail(code: string) {
  const entry = index.states.find((state) => state.state_code === code);
  if (!entry) throw new Error(`no index entry for ${code}`);
  const payload = JSON.parse(
    readFileSync(`data/state-requirements/states/${code}.json`, "utf8"),
  ) as { page_url?: string };
  return parseStateRequirementsPayload(
    {
      stateCode: entry.state_code,
      stateName: entry.state_name,
      regulationLevel: entry.regulation_level,
      compulsoryStartAge: entry.compulsory_education?.start_age ?? null,
      compulsoryEndAge: entry.compulsory_education?.end_age ?? null,
      notificationRequired: entry.notification_required,
      assessmentRequired: entry.assessment_required,
      defaultPathway: entry.default_pathway,
      sourcePageUrl: payload.page_url ?? null,
      sourceLastVerified: entry.last_verified,
    },
    payload,
  );
}

// A family with everything Homa can actually hold today: no grade (no
// column exists), which is why every sheet shows that blank.
const FULL = {
  parentName: "Robin Walker",
  addressLine: "44 Mill Lane",
  addressCity: "Gainesville",
  addressZip: "32601",
  children: [
    { name: "Finn Walker", birthdate: "2018-03-09", grade: null },
    { name: "Maya Walker", birthdate: "2020-11-21", grade: null },
    { name: "Story Walker", birthdate: "2022-11", grade: null },
  ],
};

// The other end: a family two days into Homa who filled in nothing.
const SPARSE = {
  parentName: null,
  addressLine: null,
  addressCity: null,
  addressZip: null,
  children: [{ name: "Finn", birthdate: null, grade: null }],
};

const args = process.argv.slice(2);
const codes =
  args.length === 0
    ? ["FL", "CO", "VA", "ME", "WV", "AZ", "DC"]
    : args[0] === "all"
      ? index.states.map((state) => state.state_code)
      : args.map((code) => code.toUpperCase());

let failures = 0;
for (const code of codes) {
  for (const [label, family] of [
    ["full", FULL],
    ["sparse", SPARSE],
  ] as const) {
    const detail = loadDetail(code);
    const letter = composeFilingLetter({
      detail,
      method: FILING_METHODS_BY_STATE[code],
      family,
      todayLong: "July 29, 2026",
      todayIso: "2026-07-29",
      dueLong: "August 15, 2026",
    });
    const html = wrapFilingDocument(letter, {
      familyName: "Walker",
      generatedOn: "July 29, 2026",
    });
    const rendered = await renderPrintableHtml(html);
    const base = `${outDir}/${code}-${label}`;
    writeFileSync(`${base}.pdf`, rendered.pdf);
    rendered.pageJpegs.forEach((jpeg, page) => {
      writeFileSync(`${base}-p${page + 1}.jpg`, jpeg);
    });
    const ok = rendered.pageCount === 1;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${code} ${label.padEnd(6)} ${letter.kind.padEnd(9)} pages=${rendered.pageCount} gaps=${letter.gaps.length}`,
    );
  }
}

await closePrintableRenderer();
console.log(`\nartifacts in ${outDir}`);
if (failures > 0) {
  console.error(`${failures} filing(s) did not come out one page`);
  process.exit(1);
}
