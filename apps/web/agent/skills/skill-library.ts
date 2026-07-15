import { defineDynamic, defineSkill } from "eve/skills";

import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import {
  loadSkillLibraryCaller,
  loadSkillLibraryPinned,
  resolveAdvertisedSkillRows,
} from "../../lib/agent-skills-store";

/**
 * The one skills resolver: merges the family's own saved skills
 * (family_skills, the skillify loop) with the shared Homa skills bank
 * (skill_bank, founder-curated), targeted by the family's actual children.
 * A bank skill advertises only when some child passes its age band and
 * capability tags (lib/agent-skills.ts), so a letter-sounds skill loads
 * for the family working on letters and never for a teens-only family.
 * A family skill sharing a bank skill's name overrides it, personalization
 * by construction.
 *
 * One resolver file on purpose: two dynamic resolvers emitting the same
 * skill name is a runtime ambiguity error in eve, so the merge (and its
 * precedence rule) lives here, not in eve's collision handling. Resolves
 * on turn.started so saves and bank publishes appear the next turn.
 * Failure posture: on any error, skills are absent for a turn rather than
 * the turn failing.
 */

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      try {
        const access = resolveAgentAccess(ctx.session.auth.current?.attributes);
        const rows =
          access.mode === "pinned"
            ? await loadSkillLibraryPinned(access.familyId)
            : await loadSkillLibraryCaller(access.db, access.familyId);
        if (!rows) return null;

        const merged = resolveAdvertisedSkillRows(rows);
        if (merged.length === 0) return null;

        return Object.fromEntries(
          merged.map((row) => [
            row.name,
            defineSkill({ description: row.description, markdown: row.markdown }),
          ]),
        );
      } catch (error) {
        // No family this turn (research channel, unfinished setup) is
        // expected and stays silent.
        if (error instanceof MissingFamilyContextError) return null;
        // Any other failure drops every skill for the turn (BUG-P5-3). Keep
        // the fail-open posture so the turn still runs, but never silently:
        // a distinctive line makes a resolver outage greppable and alertable
        // instead of quietly reverting the agent to its non-skill defaults
        // (e.g. a letter page losing the family's saved HWT tracing rule).
        console.error(
          "skill-library resolver failed, skills absent this turn:",
          error instanceof Error ? error.message : "unknown",
        );
        return null;
      }
    },
  },
});
