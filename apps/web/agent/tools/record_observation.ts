import { disableTool } from "eve/tools";

/**
 * Model-selected progress item writes are unsafe. manage_child_progress is
 * the only model-facing progress mutation boundary.
 */
export default disableTool();
