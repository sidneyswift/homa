import { type AuthFn } from "eve/channels/auth";

import { type PinnedAgentChannel } from "./agent-db";
import {
  EVAL_ALLOW_PROD_WRITES_FLAG,
  EVAL_DATABASE_URL_VAR,
} from "./eval-isolation";
import { type FamilyContextRows } from "./family-context";
import { joinPageBodies } from "./materials/page-shell";

/**
 * The eval host's stand-in family (2026-07-24 routing-eval investigation).
 *
 * `eve eval` drives the real agent with no session auth attributes, so
 * every eval turn used to hit the MissingFamilyContextError fallback and
 * open with "no family is set up, head to /app". The positive routing
 * evals only ever passed while the model happened to prioritize the
 * parent's request over that instruction; a model refresh behind the
 * gateway alias flipped that coin on 2026-07-24 and all of them failed
 * at once. Production never runs a turn in that state: every live
 * channel stamps a caller token or a pinned familyId. The fixture makes
 * eval sessions look like the situation the evals were written for, a
 * set-up family asking Homa for help.
 *
 * The fixture has two layers, matching the two places a turn learns its
 * family:
 *
 *   prompt · the flag alone (isEvalFamilyFixtureEnabled) lets the
 *            family-context instruction render these rows when the
 *            session has no auth attributes, so plain `eve eval` runs
 *            still open with a set-up family.
 *   tools  · under `pnpm eval:sandbox` (isEvalFamilyFixtureDbBacked)
 *            the auth walk additionally stamps eval sessions as a
 *            family-pinned channel on EVAL_FIXTURE_FAMILY_ID, and the
 *            sandbox database is seeded with the same rows
 *            (evalFamilyFixtureSeedSql). Family-scoped tools then run
 *            for real against the disposable cluster instead of failing
 *            closed with MissingFamilyContextError, which used to abort
 *            whole builds mid-eval (observed 2026-07-25, 1 of 7
 *            anchor-usage runs).
 *
 * The rows render through the real renderFamilyContext, never a
 * hand-written markdown string, so eval context cannot drift from the
 * production context shape. Child names here are load-bearing: the
 * materials-studio routing evals ask about Finn and Maya by name, and a
 * request for a child who is not in the family is correctly met with a
 * clarifying question instead of a skill load.
 */

/** Set to "1" by evals.config.ts for local eval runs; never set in prod. */
export const EVAL_FAMILY_FIXTURE_FLAG = "HOMA_EVAL_FAMILY_FIXTURE";

/**
 * The flag only counts outside Vercel: a deployed runtime keeps the
 * honest "no family" fallback even if the variable somehow leaks into
 * its environment.
 */
export function isEvalFamilyFixtureEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  return (
    environment[EVAL_FAMILY_FIXTURE_FLAG] === "1" &&
    environment.VERCEL === undefined
  );
}

/** Obviously-synthetic ids: valid UUID shape, all-zero body. */
const FIXTURE_CHILD_FINN = "00000000-0000-4000-8000-000000000001";
const FIXTURE_CHILD_MAYA = "00000000-0000-4000-8000-000000000002";
const FIXTURE_CHILD_STORY = "00000000-0000-4000-8000-000000000003";

/** The Walker family and Rachel's membership user, same synthetic scheme. */
export const EVAL_FIXTURE_FAMILY_ID = "00000000-0000-4000-8000-0000000000f0";
export const EVAL_FIXTURE_PARENT_USER_ID =
  "00000000-0000-4000-8000-0000000000a0";

const EVAL_FIXTURE_PARENT_NAME = "Rachel";

/**
 * Ages drift as the calendar advances (birth months are fixed strings);
 * that is fine, the evals assert routing and tenancy, never an exact age.
 */
export function evalFamilyFixtureRows(): FamilyContextRows {
  return {
    family: {
      name: "Walker",
      us_state: "OH",
      parent_display_name: EVAL_FIXTURE_PARENT_NAME,
      time_zone: "America/New_York",
    },
    children: [
      {
        id: FIXTURE_CHILD_FINN,
        name: "Finn",
        birth_month: "2022-03",
        profile: { interests: ["dinosaurs"], focus: "counting to 20" },
        avatar_url: null,
      },
      {
        id: FIXTURE_CHILD_MAYA,
        name: "Maya",
        birth_month: "2020-01",
        profile: {
          interests: ["drawing"],
          focus: "letter sounds and early reading",
        },
        avatar_url: null,
      },
      // A name that reads like a common noun, on purpose: the progress
      // audit's matcher once read a capitalized book title as a second
      // human, so the fixture keeps one child whose name stresses that
      // class. research-brief/materials-request-adjacent-negative asks
      // for Story by name.
      {
        id: FIXTURE_CHILD_STORY,
        name: "Story",
        birth_month: "2021-02",
        profile: {
          interests: ["animals"],
          focus: "smooth blending when reading aloud",
        },
        avatar_url: null,
      },
    ],
    memories: [],
    answers: [],
    members: [{ display_name: EVAL_FIXTURE_PARENT_NAME }],
  };
}

/**
 * True when eval sessions may be stamped with the fixture family's pinned
 * identity: the fixture flag is on (and off Vercel, per the base gate), a
 * sandbox database exists for the stamped identity to resolve against
 * (scripts/eval-sandbox.mts sets HOMA_EVAL_DATABASE_URL and seeds the
 * family), and the run has not opted back into production writes.
 *
 * Each leg guards a real failure mode:
 *   - Without the sandbox URL, plain `eve eval` has no database, so a
 *     stamped identity would turn today's honest fail-closed tools into
 *     "family context could not be loaded" noise on every turn. Those
 *     runs keep the prompt-only fixture.
 *   - Under HOMA_EVAL_ALLOW_PROD_WRITES=1 the run holds production
 *     credentials on purpose; a synthetic familyId must never ride into
 *     production tables, so the stamp stays off.
 */
export function isEvalFamilyFixtureDbBacked(
  environment: Record<string, string | undefined>,
): boolean {
  return (
    isEvalFamilyFixtureEnabled(environment) &&
    (environment[EVAL_DATABASE_URL_VAR] ?? "").length > 0 &&
    environment[EVAL_ALLOW_PROD_WRITES_FLAG] !== "1"
  );
}

/**
 * Marker attribute on eval-fixture sessions. The eve channel's onMessage
 * keys on it to skip conversation continuity: every eval session
 * authenticates as the same local-dev principal, so the continuity
 * ledger would stitch unrelated evals into one episode and feed one
 * eval's messages into the next one's context.
 */
export const EVAL_FIXTURE_SESSION_ATTRIBUTE = "evalFamilyFixture";

/**
 * The channel is typed against the pinned set on purpose: the whole
 * stamp only works because resolveAgentAccess and the family-context
 * instruction treat this channel as server-authenticated family-pinned.
 * materials-lab is the one pinned channel with no channel-specific
 * behavior gates (no NO_CARD/NO_PANEL membership, no tool restrictions),
 * so eval sessions keep the most web-like tool surface.
 */
const EVAL_FIXTURE_CHANNEL: PinnedAgentChannel = "materials-lab";

/**
 * Decorates the eve channel's localDev() auth entry. When the run is
 * db-backed (see isEvalFamilyFixtureDbBacked), a locally-authenticated
 * eval session is stamped as a family-pinned session on the seeded
 * Walker family, so family-scoped tools resolve pinned access against
 * the sandbox instead of throwing MissingFamilyContextError.
 *
 * The environment is read per request, not at composition time, so an
 * eval that needs the no-family state can still unset the fixture flag
 * in its own body. Only the wrapped entry's successes are stamped: a
 * request authenticated by Supabase or Vercel OIDC never reaches this
 * decoration, so a real principal can never be re-pinned. The inner
 * result is copied, never mutated; localDev() returns a shared module
 * constant.
 */
export function evalFamilyFixtureAuth(
  inner: AuthFn<Request>,
  environment?: Record<string, string | undefined>,
): AuthFn<Request> {
  return async (request) => {
    const auth = await inner(request);
    if (!auth || !isEvalFamilyFixtureDbBacked(environment ?? process.env)) {
      return auth;
    }
    return {
      ...auth,
      attributes: {
        ...auth.attributes,
        channel: EVAL_FIXTURE_CHANNEL,
        familyId: EVAL_FIXTURE_FAMILY_ID,
        memberName: EVAL_FIXTURE_PARENT_NAME,
        [EVAL_FIXTURE_SESSION_ATTRIBUTE]: "true",
      },
    };
  };
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

/** The fixture's YYYY-MM birth months as a Postgres date (day is always 01). */
function sqlBirthMonth(birthMonth: string): string {
  const withDay = birthMonth.length === 7 ? `${birthMonth}-01` : birthMonth;
  return `${sqlString(withDay)}::date`;
}

/**
 * Seed statements for the sandbox database, generated from the SAME rows
 * the prompt fixture renders, so the two layers cannot drift. Only
 * scripts/eval-sandbox.mts runs this, against the disposable cluster;
 * the auth.users insert targets that script's shimmed auth schema, not
 * real Supabase Auth.
 *
 * The family is seeded the way a live set-up household looks in the
 * database: status 'claimed' (map/store.ts stamps that on account
 * attach), profile completed, onboarding record done (otherwise the
 * generation gate would suppress the in-turn materials tools the evals
 * assert), and sandbox=true because that is what test families are.
 * Children get explicitly staggered created_at values: the pinned
 * loader orders by created_at, and three rows defaulting to now() in
 * one statement would tie and make child order nondeterministic.
 */
export function evalFamilyFixtureSeedSql(): string {
  const rows = evalFamilyFixtureRows();
  const family = rows.family;
  if (!family) throw new Error("eval family fixture has no family row");
  const childValues = rows.children
    .map((child, index) =>
      [
        sqlString(child.id),
        sqlString(EVAL_FIXTURE_FAMILY_ID),
        sqlString(child.name),
        sqlBirthMonth(child.birth_month),
        sqlJson(child.profile ?? {}),
        `timestamptz '2026-07-01 12:00:00+00' + interval '${index} minutes'`,
      ].join(", "),
    )
    .map((values) => `  (${values})`)
    .join(",\n");
  return `
insert into auth.users (id, email)
values (${sqlString(EVAL_FIXTURE_PARENT_USER_ID)}, 'walker-fixture@homatest.invalid');

insert into public.families
  (id, name, us_state, parent_display_name, time_zone, status,
   profile_completed_at, context, sandbox)
values
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(family.name ?? "Walker")},
   ${sqlString(family.us_state ?? "OH")},
   ${sqlString(family.parent_display_name ?? EVAL_FIXTURE_PARENT_NAME)},
   ${sqlString(family.time_zone ?? "America/New_York")}, 'claimed',
   now(), ${sqlJson({ onboarding: { state: "done" } })}, true);

insert into public.family_members (family_id, user_id, role, display_name)
values (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(EVAL_FIXTURE_PARENT_USER_ID)},
        'parent', ${sqlString(EVAL_FIXTURE_PARENT_NAME)});

insert into public.children (id, family_id, name, birth_month, profile, created_at)
values
${childValues};

${evalFixturePacketSeedSql()}
`.trim();
}

/**
 * A finalized twelve-page packet for Maya, so the packet-revision eval
 * has something real to revise.
 *
 * Twelve pages on purpose: that is the size at which the old
 * re-emit-everything path stopped working, about 45KB of html that the
 * model had to retype as tool arguments to change one page
 * (plans/2026-07-27-packet-page-revision-failure.md). Each page here is
 * deliberately bulky and individually identifiable, so an eval can prove
 * two things a small fixture could not: that the cheap path was taken,
 * and that the eleven untouched pages came back byte-identical rather
 * than being quietly regenerated from the model's memory of them.
 *
 * status 'final' so find_materials returns it without status:"any".
 */
export const EVAL_FIXTURE_PACKET_ID = "00000000-0000-4000-8000-0000000000e1";
export const EVAL_FIXTURE_PACKET_PAGES = 12;

/**
 * Artifact URLs for the seeded packet. pdf_url is NOT NULL, and the
 * family-scoped shape matters: isFamilyArtifactUrl re-checks that a
 * model-supplied URL belongs to the authenticated family, so a fixture
 * URL outside the family prefix would exercise the wrong path.
 * Never fetched by the revision eval; the sandbox blob store is
 * loopback-only anyway.
 */
const EVAL_FIXTURE_ARTIFACT_PREFIX =
  `https://eval.invalid/families/${EVAL_FIXTURE_FAMILY_ID}/materials`;

/** The marker each seeded page carries, page numbers counting from 1. */
export function evalFixturePacketPageMarker(page: number): string {
  return `homa-eval-packet-page-${page}`;
}

/** The page the revision eval asks about, by its 1-based number. */
export const EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE = 3;

/**
 * A woodland animal drawn as inline SVG, sized small on purpose.
 *
 * Inline rather than an <img>: no network fetch, deterministic bytes,
 * and Chromium renders it in the real pipeline. Small on purpose because
 * the eval asks for it to be made bigger, and a request to enlarge
 * something must have something to enlarge. The first version of this
 * fixture carried "woodland animals" only in the theme column while
 * every page body was headings and filler, so the eval was asking Homa
 * to enlarge art that did not exist; she correctly asked what was meant
 * and the run scored 1/7. An eval that rewards answering anyway is an
 * eval that rewards bluffing, which is the failure this whole change is
 * about.
 */
function evalFixtureAnimal(name: string): string {
  return [
    `<figure class="animal" data-animal="${name}" style="width:64px;height:64px;">`,
    `<svg viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${name}">`,
    `<circle cx="32" cy="36" r="18" fill="none" stroke="#4a3f35" stroke-width="2"/>`,
    `<circle cx="24" cy="18" r="7" fill="none" stroke="#4a3f35" stroke-width="2"/>`,
    `<circle cx="40" cy="18" r="7" fill="none" stroke="#4a3f35" stroke-width="2"/>`,
    `</svg>`,
    `<figcaption>${name}</figcaption>`,
    `</figure>`,
  ].join("");
}

function evalFixturePacketPageBodies(): string[] {
  const animals = ["fox", "owl", "hedgehog", "deer", "rabbit", "badger"];
  return Array.from({ length: EVAL_FIXTURE_PACKET_PAGES }, (_unused, index) => {
    const page = index + 1;
    // Padded to REAL packet scale, about 3.6KB per page and 43KB for the
    // document, because the bug only exists at that size. Measured
    // 2026-07-27: at the first size (40 repeats, 9.3KB total) a full
    // twelve-page retype fit under the revision eval's 20KB cost gate,
    // so the gate could not fire and the eval passed against pre-fix
    // code 1 run in 4. Carolyng's actual packet was ~45KB. A fixture
    // that is the right SHAPE but the wrong SCALE cannot reproduce a
    // failure whose cause is volume.
    const filler = `<p class="line">Practice line ${page}. ${"blend and read. ".repeat(216)}</p>`;
    const art =
      page === EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE
        ? `<div class="animal-row">${animals.map(evalFixtureAnimal).join("")}</div>`
        : "";
    return [
      `<div class="page" data-marker="${evalFixturePacketPageMarker(page)}">`,
      `<h2>Page ${page}: Maya's letter sounds</h2>`,
      art,
      filler,
      `</div>`,
    ].join("\n");
  });
}

export function evalFixturePacketSeedSql(): string {
  const html = joinPageBodies(evalFixturePacketPageBodies());
  return `
insert into public.materials
  (id, family_id, child_id, title, skill, pdf_url, preview_url, html,
   channel, kind, subject, theme, source, status, approved_at, created_at)
values
  (${sqlString(EVAL_FIXTURE_PACKET_ID)}, ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(FIXTURE_CHILD_MAYA)},
   'Maya''s Letter Sounds Workbook', 'letter sounds and early reading',
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/letter-sounds-workbook.pdf`)},
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/letter-sounds-workbook.jpg`)},
   ${sqlString(html)}, 'web', 'packet', 'phonics',
   'woodland animals', 'html', 'final', now(),
   timestamptz '2026-07-02 12:00:00+00');
`.trim();
}
