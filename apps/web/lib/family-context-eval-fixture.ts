import { type FamilyContextRows } from "./family-context";

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

/**
 * Ages drift as the calendar advances (birth months are fixed strings);
 * that is fine, the evals assert routing and tenancy, never an exact age.
 */
export function evalFamilyFixtureRows(): FamilyContextRows {
  return {
    family: {
      name: "Walker",
      us_state: "OH",
      parent_display_name: "Rachel",
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
    members: [{ display_name: "Rachel" }],
  };
}
