import { disableTool } from "eve/tools";

/**
 * Framework write_file is OFF (founder direction 2026-07-09, ruling in
 * docs/homa-planning/15-agentic-architecture.md §3). Nothing load-bearing
 * may live in the sandbox filesystem (BUILD.md law #2), and no product
 * flow writes files yet. Returns with the worksheet factory (M0-03/M2-05),
 * where generated artifacts upload to Blob before the turn ends.
 */
export default disableTool();
