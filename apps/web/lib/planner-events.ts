import { PLANNER_EVENT_CLIENTS, type PlannerEventClient } from "@homa/core";

/**
 * Maps a session's channel attribute onto the planner.* events' client
 * enum (issue #257, arc PR B0). The channel attribute is stamped by the
 * authenticated channel adapter, never by the model; this mapper only
 * translates vocabulary. Unknown channels (a future adapter, the eval
 * fixture's materials-lab pin) land in "other" on purpose: an event
 * with a coarse client beats a dropped event, and the enum stays honest
 * about what it actually knows.
 *
 * No next/headers anywhere in this module: agent tools import it, and
 * eve's standalone build cannot resolve Next-only modules (the same
 * constraint lib/family-events.ts documents).
 */
export function plannerEventClient(
  channel: string | undefined | null,
): PlannerEventClient {
  // A web chat session has no channel attribute at all: the caller-JWT
  // session is the default, un-pinned case.
  if (!channel || channel === "web") return "web";
  if (channel === "agent-job") return "agent_job";
  const known = PLANNER_EVENT_CLIENTS.find((client) => client === channel);
  return known ?? "other";
}
