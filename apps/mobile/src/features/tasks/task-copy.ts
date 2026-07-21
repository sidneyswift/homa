/**
 * Fixed copy for the tasks screen, ported from the web's
 * app/app/tasks/task-copy.ts (keep the built-in kind copy identical;
 * it passed both copy gates 2026-07-10 and 2026-07-12). Vocabulary law
 * for this surface: the morning artifact is a "brief", parent-created
 * things are "tasks", results are "saved to this page".
 *
 * Mobile-only difference: this screen is read-only (no write policies
 * exist on the tasks tables; web writes ride server actions the app
 * cannot call), so the placeholder notes and affordances route changes
 * to chat instead of pointing at switches and editors that are not here.
 */

export const BUILT_IN_COPY: Record<
  "morning_brief" | "journal_prompt",
  { label: string; description: string }
> = {
  morning_brief: {
    label: "Morning research brief",
    description: "One thing Homa looked into for your kids, and why it matters.",
  },
  journal_prompt: {
    label: "Evening check-in",
    description: "One easy question. Answer in a sentence and Homa remembers the day.",
  },
};

/** Web twin shows a flag-dependent note; the app cannot read that server
 * flag, so this keeps only the promise true in both worlds (no "within a
 * day" the flag-off world can't keep). */
export const BRIEF_PLACEHOLDER_NOTE =
  "It starts on its own, nothing to set up.";

/** Web twin points at the switch that appears on its page; here there is
 * no switch, so the note offers the door that does exist. */
export const JOURNAL_PLACEHOLDER_NOTE =
  "Off until you turn it on. Whenever you want it, just tell Homa in chat.";

export const SCREEN_INTRO =
  "Homa works on these by herself: morning briefs about your kids, evening check-ins, and any tasks you give her. Everything she does shows up below. Your kids' week stays in the Planner tab.";

/** The one write affordance on this screen: reassure first (nothing is
 * locked), then the offer. Changes run through Homa because the tasks
 * tables accept no app writes; chat reaches the same tools the web
 * page's server actions use. */
export const CHANGES_IN_CHAT_NOTE =
  "Everything here can change: Homa can add a task, move one, or switch one off. Just ask her in chat.";

export const ASK_HOMA_BUTTON_LABEL = "Ask Homa in chat";
