import { defineDynamic, defineSkill } from "eve/skills";

import {
  createCallerDbClient,
  MissingFamilyContextError,
} from "../../lib/agent-db";
import {
  bankSkillMatchesChildren,
  childTargetingInfo,
  FAMILY_SKILLS_MAX_COUNT,
  mergeSkillRows,
  type BankSkillRow,
  type FamilySkillRow,
} from "../../lib/agent-skills";
import { ageInMonths } from "../../lib/child-age";

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

interface ChildRow {
  birth_month: string;
  profile: { interests?: string[]; focus?: string } | null;
}

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      let clientBundle;
      try {
        clientBundle = createCallerDbClient(ctx.session.auth.current?.attributes);
      } catch (error) {
        if (error instanceof MissingFamilyContextError) return null;
        throw error;
      }
      const { db, familyId } = clientBundle;

      const [familyResult, bankResult, childrenResult] = await Promise.all([
        db
          .from("family_skills")
          .select("name, description, markdown")
          .eq("family_id", familyId)
          .order("created_at", { ascending: true })
          .limit(FAMILY_SKILLS_MAX_COUNT),
        db
          .from("skill_bank")
          .select("name, description, markdown, min_age_months, max_age_months, tags")
          .eq("published", true)
          .limit(100),
        db
          .from("children")
          .select("birth_month, profile")
          .eq("family_id", familyId),
      ]);
      if (familyResult.error || bankResult.error || childrenResult.error) {
        return null;
      }

      const now = new Date();
      const children = ((childrenResult.data ?? []) as ChildRow[]).map((child) =>
        childTargetingInfo(ageInMonths(child.birth_month, now), child.profile),
      );

      const familyRows = (familyResult.data ?? []) as Pick<
        FamilySkillRow,
        "name" | "description" | "markdown"
      >[];
      const bankRows = ((bankResult.data ?? []) as BankSkillRow[]).filter((row) =>
        bankSkillMatchesChildren(row, children),
      );

      const merged = mergeSkillRows(familyRows, bankRows);
      if (merged.length === 0) return null;

      return Object.fromEntries(
        merged.map((row) => [
          row.name,
          defineSkill({ description: row.description, markdown: row.markdown }),
        ]),
      );
    },
  },
});
