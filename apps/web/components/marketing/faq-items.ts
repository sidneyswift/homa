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
  ["Can Homa help with my state's homeschool rules?", "Homa records the teaching hours you report. The state-rules section links to each source and shows the date it was last reviewed. She does not decide whether your family meets a legal requirement. Confirm what applies on your state's official website."],
  ["Can I use my own curriculum?", "Yes. Every membership lets you tell Homa which curriculum you use. Homa Plus can read curriculum files you upload and add those lessons to your weekly plan."],
  ["What ages does Homa cover?", "Weekly planning, teaching-hour records, and finished work can include every child you add. Progress reports cover ages 2 to 16. Practice pages currently cover ages 2 to 7."],
  ["Does my child ever use it?", "No. Homa is built for you. You answer the questions and talk to Homa. Your child does not need an account and never has to talk to an AI."],
  ["How does Homa use my family's information?", "We use what you share to run Homa for your family. We do not sell it. You can ask us to delete your family's records. The Privacy page explains what Homa collects, why it is needed, which outside services process it, and how deletion works."],
  ["What if the week changes?", "Tell Homa what changed. She can move unfinished work, lighten a day, or prepare a different page while keeping completed work and hours in the record."],
  ["How much does Homa cost?", `${WALL_MECHANICS_LINE}\n\n${TIER_NAMES.regular} is $${tierPriceAmount("regular", "monthly")} a month. ${TIER_NAMES.plus} is $${tierPriceAmount("plus", "monthly")} a month. Both memberships start with the same 7 free days.\n\n${tierDescription("regular")} ${tierDescription("plus")}\n\nAnnual memberships are paid once for the year and cost 20% less than twelve monthly payments. You can stop any membership from renewing in your settings.`],
];
