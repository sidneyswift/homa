import "server-only";

/**
 * Server boundary for the otherwise pure projection.
 *
 * Next routes, repositories, and server libraries import this wrapper.
 * Pure tests import projection.ts directly without a React server condition.
 */
export { buildChildProgressView } from "./projection";
