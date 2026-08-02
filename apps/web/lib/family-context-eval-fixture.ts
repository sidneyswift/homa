import { type AuthFn } from "eve/channels/auth";

import { type PinnedAgentChannel } from "./agent-db";
import {
  EVAL_ALLOW_PROD_WRITES_FLAG,
  EVAL_DATABASE_URL_VAR,
} from "./eval-isolation";
import { type FamilyContextRows } from "./family-context";
import { joinPageBodies } from "./materials/page-shell";
import { messageSourceFromRequest } from "./chat-message-source";

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
export const EVAL_ONBOARDING_FIXTURE_FAMILY_ID =
  "00000000-0000-4000-8000-0000000000f1";
export const EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID =
  "00000000-0000-4000-8000-0000000000f2";
export const EVAL_FIRST_MAKING_FIXTURE_CHILD_ID =
  "00000000-0000-4000-8000-0000000000c1";
export const EVAL_FIXTURE_PARENT_USER_ID =
  "00000000-0000-4000-8000-0000000000a0";

const EVAL_FIXTURE_PARENT_NAME = "Rachel";
const EVAL_ONBOARDING_FIXTURE_PARENT_NAME = "Sidney";

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
 * A request-scoped opt-in for the one eval family that is deliberately
 * mid-onboarding. Headers avoid a process-global toggle, which would race when
 * the eval runner executes unrelated cases concurrently.
 */
export const EVAL_ONBOARDING_MODE_HEADER = "x-homa-eval-onboarding-mode";
export const EVAL_ONBOARDING_MODE_HEADER_VALUE = "1";
export const EVAL_FIRST_MAKING_MODE_HEADER_VALUE = "first-making";
export const EVAL_ONBOARDING_SESSION_ATTRIBUTE = "evalOnboardingMode";

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
    const onboardingMode = request.headers.get(EVAL_ONBOARDING_MODE_HEADER);
    const firstMakingModeRequested =
      onboardingMode === EVAL_FIRST_MAKING_MODE_HEADER_VALUE;
    const onboardingModeRequested =
      onboardingMode === EVAL_ONBOARDING_MODE_HEADER_VALUE ||
      firstMakingModeRequested;
    return {
      ...auth,
      attributes: {
        ...auth.attributes,
        channel: EVAL_FIXTURE_CHANNEL,
        familyId: firstMakingModeRequested
          ? EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID
          : onboardingModeRequested
            ? EVAL_ONBOARDING_FIXTURE_FAMILY_ID
            : EVAL_FIXTURE_FAMILY_ID,
        memberName: onboardingModeRequested
          ? EVAL_ONBOARDING_FIXTURE_PARENT_NAME
          : EVAL_FIXTURE_PARENT_NAME,
        messageSource: messageSourceFromRequest(request),
        ...(onboardingModeRequested
          ? {
              onboardingActive: "true",
              [EVAL_ONBOARDING_SESSION_ATTRIBUTE]: "true",
            }
          : {}),
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
   profile_completed_at, context, sandbox, billing_exempt)
values
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(family.name ?? "Walker")},
   ${sqlString(family.us_state ?? "OH")},
   ${sqlString(family.parent_display_name ?? EVAL_FIXTURE_PARENT_NAME)},
   ${sqlString(family.time_zone ?? "America/New_York")}, 'claimed',
   now(), ${sqlJson({ onboarding: { state: "done" } })}, true, true);

insert into public.family_members (family_id, user_id, role, display_name)
values (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(EVAL_FIXTURE_PARENT_USER_ID)},
        'parent', ${sqlString(EVAL_FIXTURE_PARENT_NAME)});

insert into public.children (id, family_id, name, birth_month, profile, created_at)
values
${childValues};

insert into public.families
  (id, name, us_state, parent_display_name, time_zone, status,
   profile_completed_at, context, sandbox)
values
  (${sqlString(EVAL_ONBOARDING_FIXTURE_FAMILY_ID)}, 'Onboarding fixture',
   'DC', ${sqlString(EVAL_ONBOARDING_FIXTURE_PARENT_NAME)},
   'America/New_York', 'claimed', now(),
   ${sqlJson({ onboarding: { state: "active" } })}, true);

insert into public.family_members (family_id, user_id, role, display_name)
values (${sqlString(EVAL_ONBOARDING_FIXTURE_FAMILY_ID)},
        ${sqlString(EVAL_FIXTURE_PARENT_USER_ID)}, 'parent',
        ${sqlString(EVAL_ONBOARDING_FIXTURE_PARENT_NAME)});

insert into public.families
  (id, name, us_state, parent_display_name, time_zone, status,
   profile_completed_at, context, sandbox)
values
  (${sqlString(EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID)}, 'First making fixture',
   'DC', ${sqlString(EVAL_ONBOARDING_FIXTURE_PARENT_NAME)},
   'America/New_York', 'claimed', now(),
   ${sqlJson({ onboarding: { state: "active" } })}, true);

insert into public.family_members (family_id, user_id, role, display_name)
values (${sqlString(EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID)},
        ${sqlString(EVAL_FIXTURE_PARENT_USER_ID)}, 'parent',
        ${sqlString(EVAL_ONBOARDING_FIXTURE_PARENT_NAME)});

insert into public.children
  (id, family_id, name, birth_month, profile, created_at)
values
  (${sqlString(EVAL_FIRST_MAKING_FIXTURE_CHILD_ID)},
   ${sqlString(EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID)}, 'Story',
   '2021-02-01'::date, '{}'::jsonb,
   timestamptz '2026-07-01 12:00:00+00');

${evalFixtureLibrarySeedSql()}

${evalFixturePacketSeedSql()}

${evalFixturePlannerSeedSql()}
`.trim();
}

/**
 * A real family-owned curriculum source for the lost-curriculum-stack journey
 * (gh#577). The prompt context does not mention it, so Homa can only discover
 * it through the Family Library tools, exactly like a later live conversation.
 */
export const EVAL_FIXTURE_LIBRARY_ASSET_ID =
  "00000000-0000-4000-8000-0000000000d1";
export const EVAL_FIXTURE_LIBRARY_TITLE =
  "Blossom and Root Early Years Science, Volume 1";

export function evalFixtureLibrarySeedSql(): string {
  const originalUrl =
    `https://eval.public.blob.vercel-storage.com/families/` +
    `${EVAL_FIXTURE_FAMILY_ID}/library/blossom-root-science.pdf`;
  return `
insert into public.family_assets (
  id, family_id, uploaded_by_user_id, title, original_name, url,
  download_url, media_type, byte_size, file_kind, resource_kind,
  language, status, processed_at, created_at, updated_at
)
values (
  ${sqlString(EVAL_FIXTURE_LIBRARY_ASSET_ID)},
  ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
  ${sqlString(EVAL_FIXTURE_PARENT_USER_ID)},
  ${sqlString(EVAL_FIXTURE_LIBRARY_TITLE)},
  'blossom-root-early-years-science-volume-1.pdf',
  ${sqlString(originalUrl)}, ${sqlString(`${originalUrl}?download=1`)},
  'application/pdf', 2480000, 'document', 'curriculum', 'en',
  'ready', timestamptz '2026-08-01 12:00:00+00',
  timestamptz '2026-08-01 12:00:00+00',
  timestamptz '2026-08-01 12:00:00+00'
);

insert into public.family_asset_children (family_id, asset_id, child_id)
values (
  ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
  ${sqlString(EVAL_FIXTURE_LIBRARY_ASSET_ID)},
  ${sqlString(FIXTURE_CHILD_MAYA)}
);

insert into public.family_asset_tags (
  family_id, asset_id, kind, value, catalog_id, quote, source_locator, source
)
values
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(EVAL_FIXTURE_LIBRARY_ASSET_ID)},
   'subject', 'Science', 'science', 'Nature study and science', 'Overview', 'model'),
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(EVAL_FIXTURE_LIBRARY_ASSET_ID)},
   'topic', 'seeds and plants', null,
   'Seeds and plants grow through patient observation.', 'Week 4', 'model'),
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(EVAL_FIXTURE_LIBRARY_ASSET_ID)},
   'age_band', 'Early elementary', 'early_elem',
   'Designed for early elementary learners.', 'Introduction', 'model');
`.trim();
}

/**
 * A real four-week plan, scheduled dates, and family events for the
 * Walker family (issue #257, arc PR B0), so scheduling and reshuffle
 * evals can ground in rows instead of an empty board. House rule
 * (memory: eval family fixture): new eval-visible data goes in the
 * fixture AND its seed; these rows ARE database-only truth (the prompt
 * fixture renders family context, never plans), so this seed is their
 * one home and the constants below are the eval-side handles.
 *
 * Dates are relative to the sandbox's own clock on purpose:
 *   - retest_at = now() + 18 days puts the plan in week 2 today
 *     (currentWeekIndex: plan start is retest minus 28 days, so 10
 *     elapsed days lands in the second week with a day's slack either
 *     side), which keeps the scheduled rows below inside the CURRENT
 *     week so even a family-wide open_planner call surfaces them.
 *   - Scheduled dates and events sit within a few days of today, one
 *     event deliberately in the past so look-back windows have
 *     something real to find.
 */
export const EVAL_FIXTURE_PLAN_CHILD_ID = FIXTURE_CHILD_FINN;
export const EVAL_FIXTURE_PLAN_SUBJECT = "math";
export const EVAL_FIXTURE_SCHEDULED_WEEK = 2;
export const EVAL_FIXTURE_PAST_EVENT_TITLE = "Library story time";

function evalFixturePlanJson(): unknown {
  return {
    subjectId: EVAL_FIXTURE_PLAN_SUBJECT,
    subjectName: "Math",
    childAgeLabel: "4-year-old",
    startingLine: "Counts to 10 with one-to-one pointing.",
    targets: ["Counting to 20", "Comparing small groups"],
    weeks: [1, 2, 3, 4].map((week) => ({
      week,
      focus: `Week ${week}: counting practice, played not taught.`,
      activities: [
        `Ten minutes of counting to 20 out loud, week ${week} rhythm.`,
        `Let dinosaurs carry the math: count them, sort them, week ${week}.`,
        `One real counting moment at the store or kitchen, week ${week}.`,
      ],
    })),
    styleNote: null,
    bankVersion: "eval-fixture",
  };
}

export function evalFixturePlannerSeedSql(): string {
  return `
insert into public.child_plans (child_id, subject_id, plan, bank_version, progress, retest_at)
values
  (${sqlString(EVAL_FIXTURE_PLAN_CHILD_ID)}, ${sqlString(EVAL_FIXTURE_PLAN_SUBJECT)},
   ${sqlJson(evalFixturePlanJson())}, 'eval-fixture',
   ${sqlJson({ "1.0": true })}, now() + interval '18 days');

insert into public.plan_activity_schedule
  (family_id, child_id, subject_id, week, activity_index, scheduled_date)
values
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(EVAL_FIXTURE_PLAN_CHILD_ID)},
   ${sqlString(EVAL_FIXTURE_PLAN_SUBJECT)}, ${EVAL_FIXTURE_SCHEDULED_WEEK}, 0, current_date + 1),
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(EVAL_FIXTURE_PLAN_CHILD_ID)},
   ${sqlString(EVAL_FIXTURE_PLAN_SUBJECT)}, ${EVAL_FIXTURE_SCHEDULED_WEEK}, 1, current_date + 2);

insert into public.family_events
  (family_id, child_id, title, starts_on, ends_on, start_time, end_time, note)
values
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, ${sqlString(FIXTURE_CHILD_FINN)},
   'Dentist appointment', current_date + 2, current_date + 2, '14:00', '15:00', null),
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, null,
   'Co-op day', current_date + 4, current_date + 4, null, null, null),
  (${sqlString(EVAL_FIXTURE_FAMILY_ID)}, null,
   ${sqlString(EVAL_FIXTURE_PAST_EVENT_TITLE)}, current_date - 2, current_date - 2,
   '10:00', '11:00', null);
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
export const EVAL_FIXTURE_MATERIAL_DRAFT_ID = "00000000-0000-4000-8000-0000000000e2";
export const EVAL_FIXTURE_MATERIAL_NEGATIVE_ID = "00000000-0000-4000-8000-0000000000e3";
export const EVAL_FIXTURE_MATERIAL_MIXED_ID = "00000000-0000-4000-8000-0000000000e4";
export const EVAL_FIXTURE_MATERIAL_INTERRUPTED_ID = "00000000-0000-4000-8000-0000000000e5";
export const EVAL_FIXTURE_MATERIAL_CROSS_OBJECT_ID = "00000000-0000-4000-8000-0000000000e6";
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
    // display:flex is load-bearing, not decoration: the fixture has no
    // stylesheet, and six block-level <figure> elements with no layout
    // rule stack VERTICALLY (~5.6in), pushing this page 2.19in past the
    // physical edge before Homa ever touches it (found 2026-07-30, once
    // gh#349's cutoff-page-is-a-block finally measured what this page
    // actually renders to instead of only noting it). A page whose own
    // seeded content secretly overflows makes "revising it produced a
    // cut-off page" untestable: the eval cannot tell Homa's mistake from
    // the fixture's own.
    const art =
      page === EVAL_FIXTURE_PACKET_ILLUSTRATED_PAGE
        ? `<div class="animal-row" style="display:flex;flex-wrap:wrap;gap:8px;">${animals.map(evalFixtureAnimal).join("")}</div>`
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

insert into public.materials
  (id, family_id, child_id, title, skill, pdf_url, preview_url, html,
   channel, kind, subject, theme, source, status, generation, created_at)
values
  (${sqlString(EVAL_FIXTURE_MATERIAL_DRAFT_ID)}, ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(FIXTURE_CHILD_MAYA)},
   'Maya''s Fresh Letter Sounds Page', 'letter sounds and early reading',
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/fresh-letter-sounds.pdf`)},
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/fresh-letter-sounds.jpg`)},
   '<div class="page"><h2>Maya''s fresh letter sounds</h2></div>',
   'web', 'worksheet', 'phonics', 'simple practice', 'html', 'draft',
   '{"review":{"pass":true},"pageCount":1,"pageRoles":["child"]}'::jsonb,
   timestamptz '2026-08-01 12:00:00+00');

insert into public.materials
  (id, family_id, child_id, title, skill, pdf_url, preview_url, html,
   channel, kind, subject, theme, source, status, approved_at, generation, created_at)
values
  (${sqlString(EVAL_FIXTURE_MATERIAL_NEGATIVE_ID)}, ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(FIXTURE_CHILD_MAYA)}, 'Maya''s Crowded Letter Page',
   'letter sounds and early reading',
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/negative-letter-sounds.pdf`)},
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/negative-letter-sounds.jpg`)},
   '<div class="page"><h2>Letter sounds</h2><p>Circle every sound.</p></div>',
   'web', 'worksheet', 'phonics', 'simple practice', 'html', 'final', now(),
   '{"review":{"pass":true},"pageCount":1,"pageRoles":["child"]}'::jsonb,
   timestamptz '2026-08-01 12:01:00+00'),
  (${sqlString(EVAL_FIXTURE_MATERIAL_MIXED_ID)}, ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(FIXTURE_CHILD_MAYA)}, 'Maya''s Directions Letter Page',
   'letter sounds and early reading',
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/mixed-letter-sounds.pdf`)},
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/mixed-letter-sounds.jpg`)},
   '<div class="page"><h2>Letter sounds</h2><p>Read these long directions before you begin the page.</p></div>',
   'web', 'worksheet', 'phonics', 'simple practice', 'html', 'final', now(),
   '{"review":{"pass":true},"pageCount":1,"pageRoles":["child"]}'::jsonb,
   timestamptz '2026-08-01 12:02:00+00'),
  (${sqlString(EVAL_FIXTURE_MATERIAL_INTERRUPTED_ID)}, ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(FIXTURE_CHILD_MAYA)}, 'Maya''s Practice Letter Page',
   'letter sounds and early reading',
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/interrupted-letter-sounds.pdf`)},
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/interrupted-letter-sounds.jpg`)},
   '<div class="page"><h2>Letter sounds</h2><p>Read all the directions, then begin.</p></div>',
   'web', 'worksheet', 'phonics', 'simple practice', 'html', 'final', now(),
   '{"review":{"pass":true},"pageCount":1,"pageRoles":["child"]}'::jsonb,
   timestamptz '2026-08-01 12:03:00+00'),
  (${sqlString(EVAL_FIXTURE_MATERIAL_CROSS_OBJECT_ID)}, ${sqlString(EVAL_FIXTURE_FAMILY_ID)},
   ${sqlString(FIXTURE_CHILD_MAYA)}, 'Maya''s Cross-object Letter Page',
   'letter sounds and early reading',
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/cross-letter-sounds.pdf`)},
   ${sqlString(`${EVAL_FIXTURE_ARTIFACT_PREFIX}/cross-letter-sounds.jpg`)},
   '<div class="page"><h2>Maya''s letter sounds</h2></div>',
   'web', 'worksheet', 'phonics', 'simple practice', 'html', 'final', now(),
   '{"review":{"pass":true},"pageCount":1,"pageRoles":["child"]}'::jsonb,
   timestamptz '2026-08-01 12:04:00+00');
`.trim();
}
