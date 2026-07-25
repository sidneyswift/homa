/**
 * One place that names the drip's nudges and says what each one is FOR, so
 * the founder console, the preview panel, and the family timeline all call
 * the same email the same thing.
 *
 * `target` is the load-bearing field: it states the action a nudge is trying
 * to cause, which is exactly what /admin/drip measures to answer "did it
 * work?". A nudge whose target cannot be stated plainly here has no business
 * being sent.
 */

export type DripKind =
  | "drip_setup_nudge"
  | "drip_report_unviewed"
  | "drip_loop_back"
  | "drip_add_kid"
  | "drip_revealed_never_returned"
  | "drip_kid2_pending"
  | "drip_mid_checklist";

export interface DripKindInfo {
  label: string;
  /** Who it goes to, in one phrase. */
  audience: string;
  /** The action it is trying to cause, and what counts as it working. */
  target: string;
}

export const DRIP_KINDS: Record<DripKind, DripKindInfo> = {
  drip_setup_nudge: {
    label: "Setup nudge",
    audience: "Signed up, never reached a report",
    target: "Came back and got a report",
  },
  drip_report_unviewed: {
    label: "Report ready",
    audience: "Report emailed, never opened",
    target: "Opened the report",
  },
  drip_loop_back: {
    label: "How did it go",
    audience: "Said yes to a plan, never told Homa how it went",
    target: "Told Homa how it went",
  },
  drip_add_kid: {
    label: "Add a kid",
    audience: "One kid, evidence of more",
    target: "Added another child",
  },
  drip_revealed_never_returned: {
    label: "Come back",
    audience: "Report exists, no plan, no return visit",
    target: "Came back",
  },
  drip_kid2_pending: {
    label: "Sibling's questions",
    audience: "A sibling's report is done, this child's questions never started",
    target: "Started that child's questions",
  },
  drip_mid_checklist: {
    label: "Finish the questions",
    audience: "Some answers in, no report yet",
    target: "Finished and got a report",
  },
};

export function isDripKind(kind: string): kind is DripKind {
  return kind in DRIP_KINDS;
}

/** The label for any email_sends.kind, drip or not, for mixed timelines. */
export function dripLabel(kind: string): string {
  return isDripKind(kind) ? DRIP_KINDS[kind].label : kind;
}
