import { disableTool } from "eve/tools";

/**
 * Framework web_fetch is OFF (founder direction 2026-07-09, ruling in
 * docs/homa-planning/15-agentic-architecture.md §3). Arbitrary-URL fetch
 * plus untrusted content in prompts is the classic exfiltration pair, and
 * M2-14's scanning layer is not built. web_search stays on (provider-run,
 * no model-chosen URL); re-enable fetch only behind the M2-14 posture.
 */
export default disableTool();
