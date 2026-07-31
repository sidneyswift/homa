/**
 * Replies arrive as chat markdown; the voice ribbon speaks them as one
 * soft plain line. Formatting marks would render literally there (the
 * first live turn showed "**Monday 7/27**" verbatim), so strip bold,
 * italic, code, headings, and list markers, and let newlines breathe as
 * sentence gaps. Pure on purpose: tsx --test cannot transform modules
 * that import react-native, so the testable text logic lives here and
 * transcript-ribbon.tsx stays a view.
 */
export function whisperText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/\s*\n+\s*/g, "  ")
    .trim();
}
