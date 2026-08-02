/**
 * Compatibility export for the established web import path. The protocol
 * lives in core because web rendering, server persistence, and native chat
 * must classify the exact same marker grammar.
 */
export {
  DIRECTIVE_NAMESPACE,
  formatHiddenDirective,
  hasVisibleText,
  isHiddenDirective,
  parseHiddenDirective,
  type DirectiveName,
  type HiddenDirective,
} from "@homa/core";
