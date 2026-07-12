import "server-only";

/**
 * Next-only guard for application imports. Eve-authored modules import the
 * package-free runtime entry because Eve cannot bundle the marker package.
 */
export * from "./runtime";
