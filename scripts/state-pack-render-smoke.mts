/**
 * Disposable local proof for the state pack
 * (plans/2026-07-28-state-pack.md D19): composes real states from the
 * repository's reviewed snapshots, renders through the real shell and
 * renderer, and checks planned-versus-rendered page-count parity (the
 * overflow law: a truncated legal document must never ship). Needs
 * local Chrome; writes artifacts to /tmp/state-pack-smoke for eyeball
 * and physical-print review. Not wired into CI (it needs a browser
 * binary); run by hand: pnpm tsx scripts/state-pack-render-smoke.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const { parseStateRequirementsPayload } = await import(
  "../apps/web/lib/map/state-requirements"
);
const { composeStatePack } = await import("../apps/web/lib/compliance/pack");
const { applyRequirementOverride } = await import(
  "../apps/web/lib/compliance/requirement-overrides"
);
const { closePrintableRenderer, renderPrintableHtml } = await import(
  "../apps/web/lib/materials/render-page"
);

const outDir = "/tmp/state-pack-smoke";
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
  // Same seam the live loader applies, so this smoke renders what a
  // family actually receives rather than the raw snapshot (gh#436).
  return applyRequirementOverride(
    parseStateRequirementsPayload(
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
    ),
    new Date().toISOString().slice(0, 10),
  );
}

const family = {
  familyName: "Walker",
  parentName: "Robin Walker",
  children: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Finn",
      birthdate: "2018-03-09",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Maya",
      birthdate: "2020-11-21",
    },
  ],
};

const records = {
  schoolYearStartOn: "2026-07-01",
  entries: [
    {
      happenedOn: "2026-07-08",
      childId: null,
      subject: "Science",
      minutes: 75,
    },
    {
      happenedOn: "2026-07-09",
      childId: family.children[0].id,
      subject: "Reading",
      minutes: 40,
    },
    {
      happenedOn: "2026-07-09",
      childId: family.children[1].id,
      subject: "Math",
      minutes: 35,
    },
  ],
};

// The council's deep-fixture states: NY (detailed plan, mid-year
// clause), TX (zero duty), PA (every duty, high variance), CA (pervasive
// varies), SC (notification without a published deadline). Pass one or
// more state codes to render those, or "all" to render every reviewed
// jurisdiction (the full 51-state sweep, roughly five minutes on a warm
// Chrome).
const CODES =
  process.argv[2] === "all"
    ? index.states.map((state) => state.state_code).sort()
    : process.argv.length > 2
      ? process.argv.slice(2).map((code) => code.toUpperCase())
      : ["NY", "TX", "PA", "CA", "SC"];

let failed = false;
for (const code of CODES) {
  const pack = composeStatePack({
    detail: loadDetail(code),
    family,
    packId: "12345678-abcd-4ef0-8123-456789abcdef",
    generatedOn: "July 28, 2026",
    records,
  });
  const rendered = await renderPrintableHtml(pack.html);
  const parity = rendered.pageCount === pack.pages.length;
  if (!parity) failed = true;
  console.log(
    `${code}: planned ${pack.pages.length}, rendered ${rendered.pageCount} ${parity ? "OK" : "MISMATCH"}`,
  );
  writeFileSync(path.join(outDir, `${code}.pdf`), rendered.pdf);
  rendered.pageJpegs.forEach((jpeg, i) =>
    writeFileSync(path.join(outDir, `${code}-p${i + 1}.jpg`), jpeg),
  );
}
await closePrintableRenderer();
if (failed) {
  console.error("state pack smoke FAILED: page-count mismatch");
  process.exit(1);
}
console.log(`state pack smoke passed; artifacts in ${outDir}`);
