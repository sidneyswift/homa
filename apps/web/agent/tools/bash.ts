import { disableTool } from "eve/tools";

/**
 * Framework bash is OFF (founder direction 2026-07-09, ruling in
 * docs/homa-planning/15-agentic-architecture.md §3). The live probe
 * confirmed every eve built-in ships enabled unless a sentinel file like
 * this one removes it; chat has no shell work today, the workspace is
 * empty, and M2-14's injection scanning is not built. Re-enable by
 * deleting this file, deliberately, together with the sandbox pipeline
 * (M0-03/M2-05) and its deny-all egress posture.
 */
export default disableTool();
