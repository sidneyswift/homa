import {
  TIER_NAMES,
  WALL_MECHANICS_LINE,
  tierDescription,
  tierPriceAmount,
} from "../billing/wall-copy";

/**
 * FAQ_ITEMS: the landing FAQ, single source of truth.
 * Rendered by components/marketing/Faq.tsx and serialized as FAQPage
 * JSON-LD in app/page.tsx; edit here so the two never drift apart.
 * Copy ported from the former landing composition.
 */
export const FAQ_ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["Can Homa help with my state's homeschool rules?", "Yes, with sources and clear limits. Homa shows reviewed links in a separate state-rules section and tells you when each source was last checked. She can record the teaching time you report. She does not decide whether your family meets a legal requirement. Check your state's official website to confirm what applies."],
  ["Can I use my own curriculum?", "Yes. You can tell Homa which curriculum you use with any membership. Homa Plus can read uploaded curriculum and add its lessons to the weekly plan."],
  ["What ages does Homa cover?", "The progress report covers ages 2 to 16, with questions tuned to each age. Practice pages are made from your child's current lesson rather than from a single grade-level library."],
  ["Does my child ever use it?", "No. Homa is built for you. You answer the questions and talk to Homa; your child does not need an account or an AI conversation."],
  ["What if the week changes?", "Tell Homa what changed. She can move unfinished work, lighten a day, or prepare a different page while keeping completed work and hours in the record."],
  ["How much does Homa cost?", `${WALL_MECHANICS_LINE}\n\n${TIER_NAMES.regular} is $${tierPriceAmount("regular", "monthly")} a month. ${tierDescription("regular")}\n\n${TIER_NAMES.plus} is $${tierPriceAmount("plus", "monthly")} a month. ${tierDescription("plus")}\n\n${TIER_NAMES.elite} is $${tierPriceAmount("elite", "monthly")} a month. ${tierDescription("elite")}\n\nAnnual memberships are paid once for the year and cost 20% less than twelve monthly payments. You can stop any membership from renewing in your settings.`],
];
